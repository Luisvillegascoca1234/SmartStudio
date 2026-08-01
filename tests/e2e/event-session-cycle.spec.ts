import { expect, test } from "@playwright/test"

import { TestApplication } from "./support/test-application.js"

test("administra eventos, sesiones numeradas, múltiples series, cancelación y restauración", async ({ browser }) => {
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

    await application.page.getByLabel("Etiqueta de la sesión").fill("Familia de la novia")
    await application.page.getByRole("button", { name: "Iniciar sesión" }).click()
    await expect(application.page.getByText("Sesión 1 activa")).toBeVisible()
    await application.page.getByRole("button", { name: "Iniciar serie" }).click()
    await completeCurrentSeries()

    await application.page.getByRole("button", { name: "Iniciar otra serie" }).click()
    await expect(application.page.getByRole("heading", { name: "Capturando" })).toBeVisible()
    await expect(application.page.getByText("Series anteriores")).toBeVisible()
    await application.page.getByRole("button", { name: "Simular captura RAW + JPEG" }).click()
    await application.page.getByRole("button", { name: "Cerrar serie" }).click()
    await application.page.getByRole("button", { name: "Cancelar sesión" }).click()

    await expect(application.page.getByText("Sesión 1 · Familia de la novia")).toBeVisible()
    await expect(application.page.getByText("2 series · Cancelada")).toBeVisible()
    await application.reopen()
    await application.page.getByRole("button", { name: "Restaurar" }).click()
    await expect(application.page.getByRole("heading", { name: "Revisión" })).toBeVisible()
    await expect(application.page.getByText("Series anteriores")).toBeVisible()
    await expect(application.page.getByAltText("Vista previa anterior SIM_S01_R01_001")).toBeVisible()

    await application.page.getByRole("button", { name: "Seleccionar", exact: true }).click()
    await application.page.getByRole("button", { name: "Marcar principal" }).click()
    await application.page.getByRole("button", { name: "Finalizar sesión" }).click()
    await expect(application.page.getByText("Sesión 1 · Familia de la novia")).toBeVisible()

    await application.page.getByLabel("Etiqueta de la sesión").fill("Amigos")
    await application.page.getByRole("button", { name: "Iniciar sesión" }).click()
    await expect(application.page.getByText("Sesión 2 activa")).toBeVisible()
    await application.page.getByRole("button", { name: "Iniciar serie" }).click()
    await application.page.getByRole("button", { name: "Simular captura RAW + JPEG" }).click()
    await application.page.getByRole("button", { name: "Cerrar serie" }).click()
    await application.page.getByRole("button", { name: "Cancelar sesión" }).click()
    await expect(application.page.getByAltText("Captura conservada SIM_S01_R01_001")).toBeVisible()
    await expect(application.page.getByAltText("Captura conservada SIM_S02_R01_001")).toBeVisible()

    await application.page.getByRole("button", { name: "Cerrar evento" }).click()
    await expect(application.page.getByText("Boda ciclo completo")).toBeVisible()
    await application.page.getByRole("button", { name: "Reabrir evento" }).click()
    await expect(application.page.getByText("Evento recuperado")).toBeVisible()
    await expect(application.page.getByText("Sesión 2 · Amigos")).toBeVisible()
    await application.reopen()
    await expect(application.page.getByRole("heading", { name: "Boda ciclo completo" })).toBeVisible()
  } finally {
    await application.close()
  }
})
