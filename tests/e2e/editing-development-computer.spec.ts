import { expect, test } from "@playwright/test"

import { TestApplication } from "./support/test-application.js"

test("completa el recorrido medible por CPU y mantiene la app operativa durante una demora", async ({ browser }) => {
  const application = await TestApplication.start(browser, "smartstudio-development-computer-", {
    testFeatures: true,
    editingProcessingDelayMilliseconds: 4_000,
  })
  try {
    await application.page.getByLabel("Nombre del evento").fill("Recorrido PC desarrollo")
    await application.page.getByRole("button", { name: "Crear evento" }).click()
    await application.page.getByRole("button", { name: "Iniciar sesión fotográfica" }).click()
    await application.page.getByRole("button", { name: "Iniciar serie" }).click()
    await application.page.getByRole("button", { name: "Simular captura RAW + JPEG" }).click()
    await expect(application.page.getByText("RAW + JPEG asociados", { exact: false })).toBeVisible()
    await application.page.getByRole("button", { name: "Cerrar serie" }).click()
    await application.page.getByRole("button", { name: "Seleccionar", exact: true }).click()
    await application.page.getByRole("button", { name: "Marcar principal" }).click()
    await application.page.getByRole("button", { name: "Finalizar sesión fotográfica" }).click()
    let state = await application.state()
    const jobId = state.editingJobs[0].id
    await expect.poll(async () => (await application.state()).editingJobs[0].status).toBe("processing")
    await application.page.evaluate(async (id) => fetch(`/api/test/editing/${id}/age-preview`, { method: "POST" }), jobId)
    await expect(application.page.getByText("La vista previa tarda más de 30 segundos", { exact: true })).toBeVisible()
    await expect(application.page.getByRole("button", { name: "Iniciar sesión fotográfica" })).toBeEnabled()
    await expect.poll(async () => (await application.state()).editingJobs[0].status, { timeout: 15_000 }).toBe("review")
    await application.page.getByRole("button", { name: "Aprobar edición" }).click()
    await expect(application.page.getByRole("button", { name: "Iniciar sesión fotográfica" })).toBeEnabled()
    await application.page.getByRole("button", { name: "Iniciar sesión fotográfica" }).click()
    await expect(application.page.getByText("Edición aprobada y lista para entrega", { exact: true })).toBeVisible()
    state = await application.state()
    expect(state.editingJobs[0].metrics.processingRoute).toBe("cpu")
    expect(state.editingJobs[0].metrics.previewMilliseconds).toBeGreaterThan(0)
    expect(state.editingJobs[0].metrics.deliveryMilliseconds).toBeGreaterThanOrEqual(0)
    expect(state.editingJobs[0].versions[0].deliveryStatus).toBe("ready")
    expect(state.events[0].sessions[1].status).toBe("active")
    await expect(application.page.getByText("Ruta CPU activa", { exact: false })).toBeVisible()
  } finally {
    await application.close()
  }
})
