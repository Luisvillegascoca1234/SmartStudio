import { expect, test } from "@playwright/test"

import { TestApplication } from "./support/test-application.js"

test("el operador completa el flujo simulado y lo recupera al reabrir la aplicación", async ({ browser }) => {
  const application = await TestApplication.start(browser, "smartstudio-e2e-")

  try {
    await application.page.getByLabel("Nombre del evento").fill("Boda de prueba")
    await application.page.getByRole("button", { name: "Crear evento" }).click()
    await expect(application.page.getByRole("heading", { name: "Boda de prueba" })).toBeVisible()
    await expect(application.page.locator(".event-heading time")).not.toHaveText("")
    await application.reopen()
    await expect(application.page.getByRole("heading", { name: "Boda de prueba" })).toBeVisible()

    await application.page.getByRole("button", { name: "Iniciar sesión fotográfica" }).click()
    await application.reopen()
    await expect(application.page.getByRole("button", { name: "Iniciar serie" })).toBeVisible()
    await application.page.getByRole("button", { name: "Iniciar serie" }).click()
    await application.reopen()
    await expect(application.page.getByRole("heading", { name: "Capturando" })).toBeVisible()
    await application.page.getByRole("button", { name: "Simular captura RAW + JPEG" }).click()
    await expect(application.page.getByAltText("Vista previa SIM_S01_R01_001")).toBeVisible()
    await expect(application.page.getByText("RAW + JPEG asociados · Carpeta simulada")).toBeVisible()
    await application.reopen()
    await expect(application.page.getByAltText("Vista previa SIM_S01_R01_001")).toBeVisible()

    await application.page.getByRole("button", { name: "Cerrar serie" }).click()
    await application.reopen()
    await expect(application.page.getByRole("heading", { name: "Revisión" })).toBeVisible()
    await application.page.getByRole("button", { name: "Seleccionar", exact: true }).click()
    await application.reopen()
    await expect(application.page.getByRole("button", { name: "Seleccionada" })).toBeVisible()
    await application.page.getByRole("button", { name: "Marcar principal" }).click()
    await expect(application.page.getByText("Principal", { exact: true })).toBeVisible()
    await expect(application.page.getByRole("heading", { name: "Selección lista" })).toBeVisible()

    await application.reopen()
    await expect(application.page.getByText("Evento recuperado")).toBeVisible()
    await expect(application.page.getByRole("heading", { name: "Boda de prueba" })).toBeVisible()
    await expect(application.page.getByAltText("Vista previa SIM_S01_R01_001")).toBeVisible()
    await expect(application.page.getByText("Principal", { exact: true })).toBeVisible()
    await expect(application.page.getByRole("heading", { name: "Selección lista" })).toBeVisible()
  } finally {
    await application.close()
  }
})
