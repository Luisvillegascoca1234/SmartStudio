import { expect, test } from "@playwright/test"
import { readPsd } from "ag-psd"

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

async function completeSession(application: TestApplication): Promise<string> {
  await application.page.getByRole("button", { name: "Iniciar sesión fotográfica" }).click()
  await application.page.getByRole("button", { name: "Iniciar serie" }).click()
  await application.page.getByRole("button", { name: "Simular captura RAW + JPEG" }).click()
  await expect(application.page.getByText("RAW + JPEG asociados", { exact: false })).toBeVisible()
  const state = await application.state()
  const capture = state.events[0].sessions.find((session) => session.status === "active")!.series[0].captures[0]
  await application.page.getByRole("button", { name: "Cerrar serie" }).click()
  await application.page.getByRole("button", { name: "Seleccionar", exact: true }).click()
  await application.page.getByRole("button", { name: "Marcar principal" }).click()
  await application.page.getByRole("button", { name: "Finalizar sesión fotográfica" }).click()
  return capture.baseName
}

test("prepara un PSD, pausa Adobe, reimporta una versión revisable y recupera cancelación/reinicio", async ({ browser }) => {
  const application = await TestApplication.start(browser, "smartstudio-adobe-manual-", {
    testFeatures: true,
    editingEngineFactory: (dataDirectory) => new AdobeEditingEngine(dataDirectory),
    adobeReadinessProvider: readyAdobe,
  })
  try {
    await application.page.getByLabel("Nombre del evento").fill("Corrección manual")
    await application.page.getByRole("button", { name: "Crear evento" }).click()
    const firstName = await completeSession(application)
    const firstCard = application.page.getByTestId(`editing-job-${firstName}`)
    await expect(firstCard.getByText("Lista para revisar", { exact: true })).toBeVisible()
    await firstCard.getByRole("button", { name: "Aprobar edición" }).click()
    await firstCard.getByRole("button", { name: "Necesita revisión en Photoshop" }).click()
    await expect(firstCard.getByText("Corrección manual preparada", { exact: true })).toBeVisible()
    let state = await application.state()
    const firstJob = state.editingJobs[0]
    expect(firstJob.manualCorrection?.status).toBe("prepared")
    const psdBuffer = await application.readDataFile(firstJob.manualCorrection!.psdRelativePath)
    expect(psdBuffer.subarray(0, 4).toString("ascii")).toBe("8BPS")
    const psd = readPsd(psdBuffer, { skipLayerImageData: true, skipCompositeImageData: true, skipThumbnail: true })
    expect(psd.children?.[0].name).toContain("SmartStudio-Natural")

    const secondName = await completeSession(application)
    await expect(application.page.getByTestId(`editing-job-${secondName}`).getByText("En cola", { exact: true })).toBeVisible()
    await firstCard.getByRole("button", { name: "Reimportar PSD guardado" }).click()
    await expect.poll(async () => (await application.state()).editingJobs[0].versions.length).toBe(2)
    await expect(application.page.getByTestId(`editing-job-${secondName}`).getByText("Lista para revisar", { exact: true })).toBeVisible()
    state = await application.state()
    expect(state.editingJobs[0].versions.map((version) => version.approvalStatus)).toEqual(["approved", "review"])
    expect(state.editingJobs[0].manualCorrection?.status).toBe("saved")

    await firstCard.getByRole("button", { name: "Necesita revisión en Photoshop" }).last().click()
    await firstCard.getByRole("button", { name: "Cancelar corrección manual" }).click()
    expect((await application.state()).editingJobs[0].manualCorrection?.status).toBe("cancelled")

    await firstCard.getByRole("button", { name: "Necesita revisión en Photoshop" }).last().click()
    await expect.poll(async () => (await application.state()).editingJobs[0].manualCorrection?.status).toBe("prepared")
    const preservedPsd = (await application.state()).editingJobs[0].manualCorrection!.psdRelativePath
    await application.reopen()
    state = await application.state()
    expect(state.editingJobs[0].manualCorrection?.status).toBe("interrupted")
    expect((await application.readDataFile(preservedPsd)).subarray(0, 4).toString("ascii")).toBe("8BPS")
  } finally {
    await application.close()
  }
})
