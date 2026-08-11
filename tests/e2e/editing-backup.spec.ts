import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { expect, test } from "@playwright/test"

import { TestApplication } from "./support/test-application.js"

test("respalda y verifica versiones y JPEG completo, conserva fallos y permite recuperación", async ({ browser }) => {
  test.setTimeout(90_000)
  const application = await TestApplication.start(browser, "smartstudio-editing-backup-", { testFeatures: true })
  const externalDirectory = await mkdtemp(path.join(tmpdir(), "smartstudio-editing-ssd-"))
  try {
    await application.page.getByLabel("Nombre del evento").fill("Edición respaldada")
    await application.page.getByRole("button", { name: "Crear evento" }).click()
    await application.page.getByLabel("Ruta de carpeta del SSD").fill(externalDirectory)
    await application.page.getByRole("button", { name: "Configurar SSD" }).click()
    await application.page.getByRole("button", { name: "Iniciar sesión fotográfica" }).click()
    await application.page.getByRole("button", { name: "Iniciar serie" }).click()
    await application.page.getByRole("button", { name: "Simular captura RAW + JPEG" }).click()
    await expect(application.page.getByText("RAW + JPEG asociados", { exact: false })).toBeVisible()
    await application.page.getByRole("button", { name: "Cerrar serie" }).click()
    await application.page.getByRole("button", { name: "Seleccionar", exact: true }).click()
    await application.page.getByRole("button", { name: "Marcar principal" }).click()
    await application.page.getByRole("button", { name: "Finalizar sesión fotográfica" }).click()
    await application.page.getByRole("button", { name: "Aprobar edición" }).click()
    await expect.poll(async () => (await application.state()).editingJobs[0].versions[0].deliveryStatus).toBe("ready")
    await application.page.evaluate(async () => fetch("/api/test/operations/wait-backup", { method: "POST" }))
    await expect(application.page.getByText("Respaldo verificado", { exact: true })).toBeVisible()
    let version = (await application.state()).editingJobs[0].versions[0]
    expect(version.backupStatus).toBe("verified")
    for (const relativePath of [version.previewRelativePath, version.fullRelativePath!]) {
      expect(await readFile(path.join(externalDirectory, "SmartStudioBackup", relativePath))).toEqual(await application.readDataFile(relativePath))
    }

    await application.page.getByRole("button", { name: "Iniciar sesión fotográfica" }).click()
    await application.page.getByRole("button", { name: "Iniciar serie" }).click()
    await application.page.getByRole("button", { name: "Simular captura RAW + JPEG" }).click()
    await expect(application.page.getByText("RAW + JPEG asociados", { exact: false })).toBeVisible()
    await application.page.getByRole("button", { name: "Cerrar serie" }).click()
    await application.page.getByRole("button", { name: "Seleccionar", exact: true }).click()
    await application.page.getByRole("button", { name: "Marcar principal" }).click()
    await application.page.evaluate(async () => fetch("/api/test/operations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ backupCopyFailure: true }) }))
    await application.page.getByRole("button", { name: "Finalizar sesión fotográfica" }).click()
    await expect.poll(async () => (await application.state()).editingJobs.length).toBe(2)
    await application.page.evaluate(async () => fetch("/api/test/operations/wait-backup", { method: "POST" }))
    await expect(application.page.getByText("Respaldo fallido", { exact: true }).first()).toBeVisible()
    version = (await application.state()).editingJobs[1].versions[0]
    expect(version.backupStatus).toBe("failed")

    await application.page.evaluate(async () => fetch("/api/test/operations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ backupCopyFailure: false, backupDisconnected: false }) }))
    await application.page.evaluate(async () => fetch("/api/test/operations/wait-backup", { method: "POST" }))
    await expect.poll(async () => (await application.state()).editingJobs[1].versions[0].backupStatus).toBe("verified")
    await application.reopen()
    expect((await application.state()).editingJobs[1].versions[0].backupStatus).toBe("verified")
  } finally {
    await application.close()
    await rm(externalDirectory, { recursive: true, force: true })
  }
})
