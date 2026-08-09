import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { expect, test } from "@playwright/test"

import { AdobeEditingEngine } from "../../src/server/adobe-editing-engine.js"
import type { AdobeReadiness } from "../../src/shared/operations.js"
import { TestApplication } from "./support/test-application.js"

const readyAdobe = async (): Promise<AdobeReadiness> => ({
  status: "ready", checkedAt: new Date().toISOString(), checks: [
    { id: "photoshop", label: "Photoshop", ready: true, detail: "controlado" },
    { id: "camera-raw", label: "Camera Raw", ready: true, detail: "controlado" },
    { id: "preset", label: "Preset", ready: true, detail: "controlado" },
    { id: "droplet", label: "Droplet", ready: true, detail: "controlado" },
    { id: "action", label: "Action", ready: true, detail: "controlado" },
    { id: "exchange", label: "Intercambio", ready: true, detail: "controlado" },
    { id: "offline-resources", label: "Recursos", ready: true, detail: "controlado" },
  ],
})

test("respalda artefactos Adobe, sobrevive al SSD desconectado y bloquea archivos nuevos con espacio crítico", async ({ browser }) => {
  const backupDirectory = await mkdtemp(path.join(tmpdir(), "smartstudio-adobe-ssd-"))
  const application = await TestApplication.start(browser, "smartstudio-adobe-backup-", {
    testFeatures: true,
    editingEngineFactory: (dataDirectory) => new AdobeEditingEngine(dataDirectory),
    adobeReadinessProvider: readyAdobe,
  })
  try {
    await application.page.getByLabel("Nombre del evento").fill("Adobe respaldado")
    await application.page.getByRole("button", { name: "Crear evento" }).click()
    await application.page.getByLabel("Ruta de carpeta del SSD").fill(backupDirectory)
    await application.page.getByRole("button", { name: "Configurar SSD" }).click()
    await application.page.getByRole("button", { name: "Iniciar sesión fotográfica" }).click()
    await application.page.getByRole("button", { name: "Iniciar serie" }).click()
    await application.page.getByRole("button", { name: "Simular captura RAW + JPEG" }).click()
    await expect(application.page.getByText("RAW + JPEG asociados", { exact: false })).toBeVisible()
    const capture = (await application.state()).events[0].sessions[0].series[0].captures[0]
    await application.page.getByRole("button", { name: "Cerrar serie" }).click()
    await application.page.getByRole("button", { name: "Seleccionar", exact: true }).click()
    await application.page.getByRole("button", { name: "Marcar principal" }).click()
    await application.page.getByRole("button", { name: "Finalizar sesión fotográfica" }).click()
    const card = application.page.getByTestId(`editing-job-${capture.baseName}`)
    await expect(card.getByText("Lista para revisar", { exact: true })).toBeVisible()
    await card.getByRole("button", { name: "Aprobar edición" }).click()
    await card.getByRole("button", { name: "Necesita revisión en Photoshop" }).click()
    await expect(card.getByText("Corrección manual preparada", { exact: true })).toBeVisible()
    await application.page.evaluate(async () => fetch("/api/test/operations/wait-backup", { method: "POST" }))
    await expect.poll(async () => (await application.state()).editingJobs[0].manualCorrection?.backupStatus).toBe("verified")
    let state = await application.state()
    const job = state.editingJobs[0]
    const artifacts = [job.versions[0].previewRelativePath, job.versions[0].fullRelativePath!, job.manualCorrection!.psdRelativePath]
    for (const artifact of artifacts) {
      expect(await readFile(path.join(backupDirectory, "SmartStudioBackup", artifact))).toEqual(await application.readDataFile(artifact))
    }
    expect(JSON.parse(await readFile(path.join(backupDirectory, "SmartStudioBackup", "workflow-state.json"), "utf8")).editingJobs[0].approvedVersionId).toBe(job.approvedVersionId)
    await card.getByRole("button", { name: "Cancelar corrección manual" }).click()

    await application.page.evaluate(async () => fetch("/api/test/operations", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ backupDisconnected: true, freeBytes: 150 * 1024 ** 3 }),
    }))
    await card.getByRole("button", { name: "Solicitar SmartStudio-Fondo" }).click()
    await expect.poll(async () => (await application.state()).editingJobs[0].versions.length).toBe(2)
    await application.page.evaluate(async () => fetch("/api/test/operations/wait-backup", { method: "POST" }))
    expect((await application.state()).editingJobs[0].versions[1].backupStatus).toBe("failed")

    await application.page.evaluate(async () => fetch("/api/test/operations", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ backupDisconnected: false, backupCopyFailure: false }),
    }))
    await application.page.evaluate(async () => fetch("/api/test/operations/wait-backup", { method: "POST" }))
    await expect.poll(async () => (await application.state()).editingJobs[0].versions[1].backupStatus).toBe("verified")

    await application.page.evaluate(async () => fetch("/api/test/operations", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ freeBytes: 19 * 1024 ** 3 }),
    }))
    state = await application.state()
    const criticalStatus = await application.page.evaluate(async ({ id, versionId }) =>
      (await fetch(`/api/editing/${id}/manual/prepare`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ versionId }),
      })).status, { id: state.editingJobs[0].id, versionId: state.editingJobs[0].versions[1].id })
    expect(criticalStatus).toBe(409)
    await application.reopen()
    expect((await application.state()).editingJobs[0].versions[1].backupStatus).toBe("verified")
  } finally {
    await application.close()
    await rm(backupDirectory, { recursive: true, force: true })
  }
})
