import { expect, test } from "@playwright/test"

import { TestApplication } from "./support/test-application.js"

test("administra eventos, sesiones fotográficas numeradas, múltiples series, cancelación y restauración", async ({ browser }) => {
  const application = await TestApplication.start(browser, "smartstudio-cycle-")

  const completeCurrentSeries = async () => {
    await application.page.getByRole("button", { name: "Simular captura RAW + JPEG" }).click()
    await application.page.getByRole("button", { name: "Cerrar serie" }).click()
    await application.page.getByRole("button", { name: "Seleccionar", exact: true }).click()
    await application.page.getByRole("button", { name: "Marcar principal" }).click()
  }

  try {
    await application.page.getByLabel("Nombre del evento").fill("Boda ciclo completo")
    await application.page.getByLabel("Ubicación (opcional)").fill("Salón Central")
    await application.page.getByLabel("Notas (opcional)").fill("Operador principal: Luis")
    await application.page.getByRole("button", { name: "Crear evento" }).click()
    await expect(application.page.getByText("Salón Central · Operador principal: Luis")).toBeVisible()
    await application.reopen()

    await application.page.getByLabel("Etiqueta de la sesión fotográfica").fill("Familia de la novia")
    await application.page.getByRole("button", { name: "Iniciar sesión fotográfica" }).click()
    await expect(application.page.getByText("Sesión fotográfica 1 activa")).toBeVisible()
    await application.page.getByRole("button", { name: "Iniciar serie" }).click()
    await completeCurrentSeries()

    await application.page.getByRole("button", { name: "Iniciar otra serie" }).click()
    await expect(application.page.getByRole("heading", { name: "Capturando" })).toBeVisible()
    await expect(application.page.getByText("Series anteriores")).toBeVisible()
    await application.page.getByRole("button", { name: "Simular captura RAW + JPEG" }).click()
    await application.page.getByRole("button", { name: "Cerrar serie" }).click()
    await application.page.getByRole("button", { name: "Cancelar sesión fotográfica" }).click()

    await expect(application.page.getByText("Sesión fotográfica 1 · Familia de la novia")).toBeVisible()
    await expect(application.page.getByText("2 series · Cancelada")).toBeVisible()
    await application.reopen()
    await application.page.getByRole("button", { name: "Restaurar" }).click()
    await expect(application.page.getByRole("heading", { name: "Revisión" })).toBeVisible()
    await expect(application.page.getByText("Series anteriores")).toBeVisible()
    await expect(application.page.getByAltText("Vista previa SIM_S01_R01_001")).toBeVisible()

    await application.page.getByRole("button", { name: "Seleccionar", exact: true }).click()
    await application.page.getByRole("button", { name: "Marcar principal" }).click()
    await application.page.getByRole("button", { name: "Finalizar sesión fotográfica" }).click()
    await expect(application.page.getByText("Sesión fotográfica 1 · Familia de la novia")).toBeVisible()

    await application.page.getByLabel("Etiqueta de la sesión fotográfica").fill("Amigos")
    await application.page.getByRole("button", { name: "Iniciar sesión fotográfica" }).click()
    await expect(application.page.getByText("Sesión fotográfica 2 activa")).toBeVisible()
    await application.page.getByRole("button", { name: "Iniciar serie" }).click()
    await application.page.getByRole("button", { name: "Simular captura RAW + JPEG" }).click()
    await application.page.getByRole("button", { name: "Cerrar serie" }).click()
    await application.page.getByRole("button", { name: "Cancelar sesión fotográfica" }).click()
    await expect(application.page.getByAltText("Captura conservada SIM_S01_R01_001")).toBeVisible()
    await expect(application.page.getByAltText("Captura conservada SIM_S02_R01_001")).toBeVisible()

    await application.page.getByRole("button", { name: "Cerrar evento" }).click()
    await expect(application.page.getByText("Boda ciclo completo", { exact: true })).toBeVisible()
    await application.page.getByRole("button", { name: "Reabrir evento" }).click()
    await expect(application.page.getByText("Evento recuperado")).toBeVisible()
    await expect(application.page.getByText("Sesión fotográfica 2 · Amigos")).toBeVisible()
    await application.reopen()
    await expect(application.page.getByRole("heading", { name: "Boda ciclo completo" })).toBeVisible()
  } finally {
    await application.close()
  }
})

test("recupera capturas excluidas y permite seleccionar desde series anteriores", async ({ browser }) => {
  const application = await TestApplication.start(browser, "smartstudio-series-recovery-")

  try {
    await application.page.getByLabel("Nombre del evento").fill("Evento de recuperación")
    await application.page.getByRole("button", { name: "Crear evento" }).click()

    await application.page.getByLabel("Etiqueta de la sesión fotográfica").fill("Familia QA")
    await application.page.getByRole("button", { name: "Iniciar sesión fotográfica" }).click()
    await application.page.getByRole("button", { name: "Cancelar sesión fotográfica" }).click()
    await expect(application.page.getByLabel("Etiqueta de la sesión fotográfica")).toHaveValue("")

    await application.page.getByRole("button", { name: "Restaurar" }).click()
    await application.page.getByRole("button", { name: "Iniciar serie" }).click()
    await application.page.getByRole("button", { name: "Simular captura RAW + JPEG" }).click()
    await application.page.getByRole("button", { name: "Simular captura RAW + JPEG" }).click()

    const firstCapture = application.page.getByTestId("capture-SIM_S01_R01_001")
    await firstCapture.getByRole("button", { name: "Excluir de revisión" }).click()
    await expect(firstCapture.getByRole("button", { name: "Restaurar en revisión" })).toBeVisible()
    await firstCapture.getByRole("button", { name: "Restaurar en revisión" }).click()
    await expect(firstCapture.getByRole("button", { name: "Excluir de revisión" })).toBeVisible()

    await application.page.getByRole("button", { name: "Cerrar serie" }).click()
    await application.page.getByRole("button", { name: "Iniciar otra serie" }).click()
    await application.page.getByRole("button", { name: "Simular captura RAW + JPEG" }).click()
    await application.page.getByRole("button", { name: "Cerrar serie" }).click()

    await expect(firstCapture).toBeVisible()
    await firstCapture.getByRole("button", { name: "Seleccionar", exact: true }).click()
    await firstCapture.getByRole("button", { name: "Marcar principal" }).click()
    await expect(firstCapture.getByRole("button", { name: "Es principal" })).toBeVisible()
    await expect(application.page.getByRole("button", { name: "Finalizar sesión fotográfica" })).toBeEnabled()

    await firstCapture.getByRole("button", { name: "Ampliar SIM_S01_R01_001" }).click()
    await expect(application.page.getByRole("dialog", { name: "SIM_S01_R01_001" })).toBeVisible()
    await application.page.getByRole("button", { name: "Cerrar", exact: true }).click()
  } finally {
    await application.close()
  }
})
