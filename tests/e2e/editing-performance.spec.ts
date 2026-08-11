import { expect, test } from "@playwright/test"
import { TestApplication } from "./support/test-application.js"

test("separa tiempos, calcula P95 y no afirma GPU sin evidencia", async ({ browser }) => {
  const application = await TestApplication.start(browser, "smartstudio-performance-", { testFeatures: true })
  try {
    await application.page.getByLabel("Nombre del evento").fill("Rendimiento")
    await application.page.getByRole("button", { name: "Crear evento" }).click()
    await application.page.getByRole("button", { name: "Iniciar sesión fotográfica" }).click()
    await application.page.getByRole("button", { name: "Iniciar serie" }).click()
    for (let index = 0; index < 2; index += 1) await application.page.getByRole("button", { name: "Simular captura RAW + JPEG" }).click()
    await expect(application.page.getByText("RAW + JPEG asociados", { exact: false })).toHaveCount(2)
    await application.page.getByRole("button", { name: "Cerrar serie" }).click()
    const captures = (await application.state()).events[0].sessions[0].series[0].captures
    for (const capture of captures) await application.page.getByTestId(`capture-${capture.baseName}`).getByRole("button", { name: "Seleccionar", exact: true }).click()
    await application.page.getByTestId(`capture-${captures[0].baseName}`).getByRole("button", { name: "Marcar principal" }).click()
    await application.page.getByRole("button", { name: "Finalizar sesión fotográfica" }).click()
    await expect(application.page.getByText("Lista para revisar", { exact: true })).toHaveCount(1)
    await application.page.getByTestId(`editing-job-${captures[0].baseName}`).getByRole("button", { name: "Procesar alternativa" }).click()
    await expect(application.page.getByText("Lista para revisar", { exact: true })).toHaveCount(2)
    const report = await application.page.evaluate(async () => fetch("/api/editing/performance").then((response) => response.json()))
    expect(report).toMatchObject({ sampleSize: 2, representative: false, openCl: "inconclusive", routes: { cpu: 2, gpu: 0 } })
    expect(report.previewMilliseconds.p95).toBeGreaterThan(0)
    expect(report.previewMilliseconds.target).toBe(30_000)
    expect(report.stageP95Milliseconds).toEqual(expect.objectContaining({ development: expect.any(Number), analysis: expect.any(Number), skin: expect.any(Number), eyesTeeth: expect.any(Number), facialLighting: expect.any(Number), backdrop: expect.any(Number), export: expect.any(Number) }))
  } finally {
    await application.close()
  }
})
