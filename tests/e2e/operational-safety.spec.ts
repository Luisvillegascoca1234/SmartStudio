import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { expect, test } from "@playwright/test"

import type { OperationsSnapshot } from "../../src/shared/operations.js"
import { TestApplication } from "./support/test-application.js"

const GIBIBYTE = 1024 ** 3

test("protege nuevas sesiones y verifica el respaldo externo sin detener la sesión activa", async ({ browser }) => {
  const application = await TestApplication.start(browser, "smartstudio-safety-", { testFeatures: true })
  const externalDirectory = await mkdtemp(path.join(tmpdir(), "smartstudio-ssd-"))

  const setConditions = async (conditions: Record<string, unknown>): Promise<OperationsSnapshot> => {
    return application.page.evaluate(async (body) => {
      const response = await fetch("/api/test/operations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      return response.json()
    }, conditions) as Promise<OperationsSnapshot>
  }

  const reloadOperations = async () => {
    await application.page.reload()
    await expect(application.page.getByRole("region", { name: "Verificación previa" })).toBeVisible()
  }

  try {
    await setConditions({ freeBytes: 180 * GIBIBYTE, power: "ac", captureSource: "ready" })
    await application.page.getByLabel("Nombre del evento").fill("Boda con respaldo")
    await application.page.getByRole("button", { name: "Crear evento" }).click()
    await expect(application.page.getByText("Suficiente")).toBeVisible()
    await expect(application.page.getByText("Conectada a corriente")).toBeVisible()
    await expect(application.page.getByText(/tarjeta de la cámara sigue siendo la copia original obligatoria/i)).toBeVisible()

    await setConditions({ freeBytes: 50 * GIBIBYTE, power: "battery" })
    await reloadOperations()
    await expect(application.page.getByText("Espacio interno bajo")).toBeVisible()
    await expect(application.page.getByRole("button", { name: "Iniciar sesión" })).toBeEnabled()

    await setConditions({ freeBytes: 5 * GIBIBYTE })
    await reloadOperations()
    await expect(application.page.getByText("Espacio crítico: nueva sesión bloqueada")).toBeVisible()
    await expect(application.page.getByRole("button", { name: "Iniciar sesión" })).toBeDisabled()

    await application.page.getByLabel("Ruta de carpeta del SSD").fill(externalDirectory)
    await application.page.getByRole("button", { name: "Configurar SSD" }).click()
    await expect(application.page.getByText("Disponible")).toBeVisible()
    await expect(application.page.getByRole("button", { name: "Iniciar sesión" })).toBeEnabled()
    await application.page.getByRole("button", { name: "Iniciar sesión" }).click()
    await application.page.getByRole("button", { name: "Iniciar serie" }).click()
    await application.page.getByRole("button", { name: "Simular captura RAW + JPEG" }).click()
    await expect(application.page.getByTestId("capture-SIM_S01_R01_001").getByText("RAW + JPEG asociados", { exact: false })).toBeVisible()

    const verified = await application.page.evaluate(async () => {
      const response = await fetch("/api/test/operations/wait-backup", { method: "POST" })
      return response.json()
    }) as OperationsSnapshot
    expect(verified.backup.status).toBe("verified")
    expect(verified.backup.verifiedFiles).toBeGreaterThanOrEqual(3)

    const state = await application.state()
    const capture = state.events[0].sessions[0].series[0].captures[0]
    const internalRaw = await application.readDataFile(capture.rawRelativePath!)
    const externalRaw = await readFile(path.join(externalDirectory, "SmartStudioBackup", capture.rawRelativePath!))
    expect(externalRaw.equals(internalRaw)).toBe(true)

    await application.page.evaluate(() => {
      const soundWindow = window as typeof window & { smartStudioSoundAttempts: number }
      soundWindow.smartStudioSoundAttempts = 0
      window.AudioContext = class {
        currentTime = 0
        destination = {} as AudioDestinationNode
        resume = async () => undefined
        close = async () => undefined
        createOscillator = () => ({
          frequency: { value: 0 },
          connect: () => undefined,
          start: () => { soundWindow.smartStudioSoundAttempts += 1 },
          stop: () => undefined,
          addEventListener: (_name: string, listener: () => void) => listener(),
        }) as unknown as OscillatorNode
      } as unknown as typeof AudioContext
    })
    await setConditions({ backupCopyFailure: true })
    await application.page.getByRole("button", { name: "Simular captura RAW + JPEG" }).click()
    await expect(application.page.getByTestId("capture-SIM_S01_R01_002").getByText("RAW + JPEG asociados", { exact: false })).toBeVisible()
    const failed = await application.page.evaluate(async () => {
      const response = await fetch("/api/test/operations/wait-backup", { method: "POST" })
      return response.json()
    }) as OperationsSnapshot
    expect(failed.backup.status).toBe("error")
    await expect(application.page.getByText("Problema con el respaldo externo")).toBeVisible()
    await expect(application.page.getByRole("heading", { name: "Capturando" })).toBeVisible()
    await expect.poll(() => application.page.evaluate(() => (window as typeof window & { smartStudioSoundAttempts: number }).smartStudioSoundAttempts)).toBe(1)

    await application.page.getByRole("button", { name: "Alertas sonoras: activadas" }).click()
    await expect(application.page.getByRole("button", { name: "Alertas sonoras: desactivadas" })).toBeVisible()

    await setConditions({ backupCopyFailure: false, backupDisconnected: true })
    await expect(application.page.getByText(/SSD se desconectó/i)).toBeVisible()
    await expect.poll(() => application.page.evaluate(() => (window as typeof window & { smartStudioSoundAttempts: number }).smartStudioSoundAttempts)).toBe(1)

    await application.page.getByRole("button", { name: "Cerrar serie" }).click()
    await application.page.getByTestId("capture-SIM_S01_R01_001").getByRole("button", { name: "Seleccionar", exact: true }).click()
    await application.page.getByTestId("capture-SIM_S01_R01_001").getByRole("button", { name: "Marcar principal" }).click()
    await application.page.getByRole("button", { name: "Finalizar sesión" }).click()
    await expect(application.page.getByText("Espacio crítico: nueva sesión bloqueada")).toBeVisible()
    await expect(application.page.getByRole("button", { name: "Iniciar sesión" })).toBeDisabled()

    await application.reopen()
    await expect(application.page.getByText("Problema con el respaldo externo")).toBeVisible()
    await expect(application.page.getByText("Sesión 1")).toBeVisible()
  } finally {
    await application.close()
    await rm(externalDirectory, { recursive: true, force: true })
  }
})
