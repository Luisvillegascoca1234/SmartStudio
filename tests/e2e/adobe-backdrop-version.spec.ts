import { expect, test } from "@playwright/test"

import { AdobeEditingEngine } from "../../src/server/adobe-editing-engine.js"
import type { AdobeReadiness } from "../../src/shared/operations.js"
import { TestApplication } from "./support/test-application.js"

const readyAdobe = async (): Promise<AdobeReadiness> => ({
  status: "ready", checkedAt: new Date().toISOString(),
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

test("crea, compara, rechaza y aprueba SmartStudio-Fondo como versión explícita", async ({ browser }) => {
  const application = await TestApplication.start(browser, "smartstudio-adobe-backdrop-", {
    testFeatures: true,
    editingEngineFactory: (dataDirectory) => new AdobeEditingEngine(dataDirectory),
    adobeReadinessProvider: readyAdobe,
  })
  try {
    await application.page.getByLabel("Nombre del evento").fill("Fondo Adobe")
    await application.page.getByRole("button", { name: "Crear evento" }).click()
    await expect(application.page.getByRole("button", { name: "Solicitar SmartStudio-Fondo" })).toHaveCount(0)
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
    await expect(card.getByText("Edición aprobada y lista para entrega", { exact: true })).toBeVisible()

    await card.getByRole("button", { name: "Solicitar SmartStudio-Fondo" }).click()
    await expect.poll(async () => (await application.state()).editingJobs[0].versions.length).toBe(2)
    let state = await application.state()
    expect(state.editingJobs[0].versions.map((version) => version.automation)).toEqual(["natural", "backdrop"])
    expect(state.editingJobs[0].versions[0].approvalStatus).toBe("approved")
    expect(state.editingJobs[0].versions[1].approvalStatus).toBe("review")
    expect(state.editingJobs[0].versions[1].adobeResources.action.name).toBe("SmartStudio-Fondo")
    await expect(card.getByLabel("Revisión de bordes SmartStudio-Fondo")).toBeVisible()
    await expect(card.getByAltText("Versión Natural para comparar")).toBeVisible()

    await card.getByRole("button", { name: "Rechazar versión 2" }).click()
    state = await application.state()
    expect(state.editingJobs[0].versions[1].approvalStatus).toBe("rejected")
    expect(state.editingJobs[0].currentVersionId).toBe(state.editingJobs[0].versions[0].id)

    await card.getByRole("button", { name: "Solicitar SmartStudio-Fondo" }).click()
    await expect.poll(async () => (await application.state()).editingJobs[0].versions.length).toBe(3)
    await card.getByRole("button", { name: "Aprobar versión 3" }).click()
    state = await application.state()
    expect(state.editingJobs[0].versions.map((version) => version.approvalStatus)).toEqual(["superseded", "rejected", "approved"])
    expect(state.editingJobs[0].backdropCompletion).toBe("completed")
  } finally {
    await application.close()
  }
})
