import { createHash } from "node:crypto"
import { expect, test } from "@playwright/test"

import { AdobeEditingEngine } from "../../src/server/adobe-editing-engine.js"
import type { AdobeReadiness } from "../../src/shared/operations.js"
import { TestApplication } from "./support/test-application.js"

const readyAdobe = async (): Promise<AdobeReadiness> => ({
  status: "ready",
  checkedAt: new Date().toISOString(),
  checks: [
    { id: "photoshop", label: "Photoshop", ready: true, detail: "controlado" },
    { id: "camera-raw", label: "Camera Raw", ready: true, detail: "controlado" },
    { id: "preset", label: "Preset", ready: true, detail: "controlado" },
    { id: "droplet", label: "Droplet", ready: true, detail: "controlado" },
    { id: "action", label: "Action", ready: true, detail: "controlado" },
    { id: "exchange", label: "Intercambio", ready: true, detail: "controlado" },
    { id: "offline-resources", label: "Recursos", ready: true, detail: "controlado" },
  ],
})

const digest = (contents: Buffer): string => createHash("sha256").update(contents).digest("hex")

async function completeSession(application: TestApplication): Promise<string> {
  await application.page.getByRole("button", { name: "Iniciar sesión fotográfica" }).click()
  await application.page.getByRole("button", { name: "Iniciar serie" }).click()
  await application.page.getByRole("button", { name: "Simular captura RAW + JPEG" }).click()
  await expect(application.page.getByText("RAW + JPEG asociados", { exact: false })).toBeVisible()
  const state = await application.state()
  const event = state.events.find((item) => item.id === state.activeEventId)!
  const capture = event.sessions.find((item) => item.status === "active")!.series[0].captures[0]
  await application.page.getByRole("button", { name: "Cerrar serie" }).click()
  await application.page.getByRole("button", { name: "Seleccionar", exact: true }).click()
  await application.page.getByRole("button", { name: "Marcar principal" }).click()
  await application.page.getByRole("button", { name: "Finalizar sesión fotográfica" }).click()
  await expect(application.page.getByTestId(`editing-job-${capture.baseName}`).getByText("Lista para revisar", { exact: true })).toBeVisible()
  return capture.baseName
}

test("fija recursos Adobe por trabajo y conserva versiones al ajustar, restablecer y adoptar una actualización", async ({ browser }) => {
  const application = await TestApplication.start(browser, "smartstudio-adobe-resources-", {
    testFeatures: true,
    editingEngineFactory: (dataDirectory) => new AdobeEditingEngine(dataDirectory),
    adobeReadinessProvider: readyAdobe,
  })
  try {
    await application.page.getByLabel("Nombre del evento").fill("Recursos Adobe")
    await application.page.getByRole("button", { name: "Crear evento" }).click()
    const baseName = await completeSession(application)
    const card = application.page.getByTestId(`editing-job-${baseName}`)
    let state = await application.state()
    const jobId = state.editingJobs[0].id
    const firstDigest = digest(await application.readDataFile(state.editingJobs[0].versions[0].fullRelativePath!))
    expect(state.events[0].adobeResources.bundleVersion).toBe("1.0.0")
    expect(state.editingJobs[0].adobeResources).toEqual(state.events[0].adobeResources)
    expect(state.editingJobs[0].versions[0].adobeResources.bundleVersion).toBe("1.0.0")

    const invalidStatus = await application.page.evaluate(async (id) =>
      (await fetch(`/api/editing/${id}/adjustments`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ exposure: 1.1 }),
      })).status, jobId)
    expect(invalidStatus).toBe(409)

    await card.getByLabel("Exposición").fill("0.7")
    await card.getByLabel("Temperatura").fill("-0.4")
    await card.getByLabel("Intensidad de color").fill("0.5")
    await card.getByLabel("Suavizado de piel").fill("2")
    await card.getByRole("button", { name: "Aplicar ajustes" }).click()
    await expect.poll(async () => (await application.state()).editingJobs[0].versions.length).toBe(2)
    state = await application.state()
    expect(state.editingJobs[0].versions.map((version) => version.adobeResources.bundleVersion)).toEqual(["1.0.0", "1.0.0"])
    expect(digest(await application.readDataFile(state.editingJobs[0].versions[1].fullRelativePath!))).not.toBe(firstDigest)

    await card.getByRole("button", { name: "Restablecer edición automática" }).click()
    await expect.poll(async () => (await application.state()).editingJobs[0].versions.length).toBe(3)
    expect((await application.state()).editingJobs[0].adjustments).toEqual({ exposure: 0, temperature: 0, colorIntensity: 0, skinSmoothing: 1 })

    await application.page.getByRole("button", { name: "Nueva versión del perfil" }).click()
    state = await application.state()
    expect(state.events[0].adobeResources.bundleVersion).toBe("2.0.0")
    expect(state.editingJobs[0].adobeResources.bundleVersion).toBe("1.0.0")
    await card.getByRole("button", { name: "Reprocesar con perfil v2" }).click()
    await expect.poll(async () => (await application.state()).editingJobs[0].versions.length).toBe(4)
    state = await application.state()
    expect(state.editingJobs[0].versions.map((version) => version.adobeResources.bundleVersion)).toEqual(["1.0.0", "1.0.0", "1.0.0", "2.0.0"])

    await completeSession(application)
    state = await application.state()
    expect(state.editingJobs[1].adobeResources.bundleVersion).toBe("2.0.0")
    await application.reopen()
    state = await application.state()
    expect(state.editingJobs[0].versions.map((version) => version.adobeResources.bundleVersion)).toEqual(["1.0.0", "1.0.0", "1.0.0", "2.0.0"])
  } finally {
    await application.close()
  }
})
