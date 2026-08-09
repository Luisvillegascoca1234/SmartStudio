import { mkdir } from "node:fs/promises"
import path from "node:path"
import { expect, test } from "@playwright/test"
import sharp from "sharp"

import type { EditingEngine } from "../../src/server/editing-engine.js"
import type { AdobeReadiness } from "../../src/shared/operations.js"
import { TestApplication } from "./support/test-application.js"

const controlledAdobeEngine: EditingEngine = {
  id: "adobe",
  async render(_job, _capture, destination, _origin, lightweight) {
    await mkdir(path.dirname(destination), { recursive: true })
    await sharp({
      create: {
        width: lightweight ? 640 : 1_280,
        height: lightweight ? 426 : 852,
        channels: 3,
        background: { r: 52, g: 76, b: 98 },
      },
    }).jpeg({ quality: 90 }).toFile(destination)
    return {
      lensCorrectionApplied: true,
      portraitResult: { faces: 1, treated: 1, eyesEnhanced: true, teethWhitened: true, warnings: [], backdrop: "unchanged", backdropDiagnostics: null },
      processingRoute: "cpu",
      usedRawFallback: false,
    }
  },
}

const readyAdobe = (): Promise<AdobeReadiness> => Promise.resolve({
  status: "ready",
  checkedAt: new Date().toISOString(),
  checks: [
    { id: "photoshop", label: "Photoshop estable", ready: true, detail: "controlado" },
    { id: "camera-raw", label: "Adobe Camera Raw", ready: true, detail: "controlado" },
    { id: "preset", label: "Preset seleccionado", ready: true, detail: "controlado" },
    { id: "droplet", label: "Droplet de Photoshop", ready: true, detail: "controlado" },
    { id: "action", label: "Action de Photoshop", ready: true, detail: "controlado" },
    { id: "exchange", label: "Carpetas de intercambio", ready: true, detail: "controlado" },
    { id: "offline-resources", label: "Recursos para operar sin conexión", ready: true, detail: "controlado" },
  ],
})

async function prepareEditing(application: TestApplication, eventName: string) {
  await application.page.getByLabel("Nombre del evento").fill(eventName)
  await application.page.getByRole("button", { name: "Crear evento" }).click()
  await application.page.getByRole("button", { name: "Iniciar sesión fotográfica" }).click()
  await application.page.getByRole("button", { name: "Iniciar serie" }).click()
  await application.page.getByRole("button", { name: "Simular captura RAW + JPEG" }).click()
  await expect(application.page.getByText("RAW + JPEG asociados", { exact: false })).toBeVisible()
  const capture = (await application.state()).events[0].sessions[0].series[0].captures[0]
  await application.page.getByRole("button", { name: "Cerrar serie" }).click()
  const card = application.page.getByTestId(`capture-${capture.baseName}`)
  await card.getByRole("button", { name: "Seleccionar", exact: true }).click()
  await card.getByRole("button", { name: "Marcar principal" }).click()
  await application.page.getByRole("button", { name: "Finalizar sesión fotográfica" }).click()
  await expect(application.page.getByText("Versión 1", { exact: false }).first()).toBeVisible()
  return capture
}

test("identifica y conserva un motor Adobe controlado de extremo a extremo", async ({ browser }) => {
  const application = await TestApplication.start(browser, "smartstudio-engine-adobe-", {
    testFeatures: true,
    editingEngine: controlledAdobeEngine,
    adobeReadinessProvider: readyAdobe,
  })
  try {
    const capture = await prepareEditing(application, "Identificación Adobe")
    const card = application.page.getByTestId(`editing-job-${capture.baseName}`)
    await expect(card.getByText("Motor Adobe", { exact: true })).toBeVisible()
    await expect(card.getByText(/Versión 1 .* Motor Adobe/)).toBeVisible()
    let state = await application.state()
    expect(state.editingJobs[0].engine).toBe("adobe")
    expect(state.editingJobs[0].versions[0].engine).toBe("adobe")

    await application.reopen()
    const reopenedCard = application.page.getByTestId(`editing-job-${capture.baseName}`)
    await expect(reopenedCard.getByText("Motor Adobe", { exact: true })).toBeVisible()
    await expect(reopenedCard.getByText(/Versión 1 .* Motor Adobe/)).toBeVisible()
    state = await application.state()
    expect(state.editingJobs[0].engine).toBe("adobe")
    expect(state.editingJobs[0].versions[0].engine).toBe("adobe")
  } finally {
    await application.close()
  }
})

test("migra trabajos y versiones anteriores como motor local", async ({ browser }) => {
  const application = await TestApplication.start(browser, "smartstudio-engine-legacy-", { testFeatures: true })
  try {
    const capture = await prepareEditing(application, "Motor heredado")
    await application.rewritePersistedState((state) => {
      const legacy = structuredClone(state) as {
        version: number
        editingJobs: Array<{ engine?: unknown; versions: Array<{ engine?: unknown }> }>
      }
      legacy.version = 10
      for (const job of legacy.editingJobs) {
        delete job.engine
        for (const version of job.versions) delete version.engine
      }
      return legacy as unknown as Record<string, unknown>
    })

    const state = await application.state()
    expect(state.version).toBe(17)
    expect(state.editingJobs[0].engine).toBe("local")
    expect(state.editingJobs[0].versions[0].engine).toBe("local")
    const card = application.page.getByTestId(`editing-job-${capture.baseName}`)
    await expect(card.getByText("Motor local", { exact: true })).toBeVisible()
    await expect(card.getByText(/Versión 1 .* Motor local/)).toBeVisible()
  } finally {
    await application.close()
  }
})
