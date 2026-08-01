import { expect, test } from "@playwright/test"

import { TestApplication } from "./support/test-application.js"

test("advierte problemas de calidad y mantiene la selección bajo control humano", async ({ browser }) => {
  const application = await TestApplication.start(browser, "smartstudio-quality-", {
    testFeatures: true,
    path: "/?quality-fixtures=1",
  })

  try {
    await application.page.getByLabel("Nombre del evento").fill("Calidad controlada")
    await application.page.getByRole("button", { name: "Crear evento" }).click()
    await application.page.getByRole("button", { name: "Iniciar sesión" }).click()
    await application.page.getByRole("button", { name: "Iniciar serie" }).click()
    await application.page.getByRole("button", { name: "Cargar fotografías controladas" }).click()
    await application.page.getByRole("button", { name: "Cerrar serie" }).click()

    await expect(application.page.getByText("Posible desenfoque").first()).toBeVisible()
    await expect(application.page.getByText("Posible movimiento")).toBeVisible()
    await expect(application.page.getByText("Posibles ojos cerrados")).toBeVisible()
    await expect(application.page.getByText("Revisar encuadre")).toBeVisible()
    await expect(application.page.getByText("Exposición incorrecta")).toBeVisible()
    await expect(application.page.getByText("Archivo incompleto")).toBeVisible()
    await expect(application.page.getByText("Seleccionada", { exact: true })).toHaveCount(0)
    await expect(application.page.getByText("Excluida", { exact: true })).toHaveCount(0)

    await application.page.getByRole("button", { name: "Ampliar SIM_S01_R01_001" }).click()
    await expect(application.page.getByAltText("Vista ampliada SIM_S01_R01_001")).toBeVisible()
    await application.page.getByRole("button", { name: "Cerrar" }).click()
    await application.page.getByRole("button", { name: "Ordenar por calidad" }).click()
    await expect(application.page.getByRole("button", { name: "Orden original" })).toBeVisible()
    await expect(application.page.getByTestId("capture-SIM_S01_R01_006")).toBeVisible()

    for (const number of [1, 2, 3]) {
      await application.page
        .getByTestId(`capture-SIM_S01_R01_00${number}`)
        .getByRole("button", { name: "Seleccionar", exact: true })
        .click()
    }
    await expect(application.page.getByText("3 de 3 seleccionadas")).toBeVisible()
    await expect(application.page.getByText("Falta definir la principal")).toBeVisible()
    await expect(
      application.page.getByTestId("capture-SIM_S01_R01_004").getByRole("button", { name: "Seleccionar", exact: true }),
    ).toBeDisabled()

    await application.page.getByTestId("capture-SIM_S01_R01_001").getByRole("button", { name: "Marcar principal" }).click()
    await expect(application.page.getByText("Sesión lista para edición")).toBeVisible()
    await application.page.getByRole("button", { name: "Hacer principal" }).first().click()
    await expect(application.page.getByText("3 de 3 seleccionadas")).toBeVisible()
    await expect(application.page.getByText("Principal definida")).toBeVisible()

    await application.page.getByTestId("selection-SIM_S01_R01_002").getByRole("button", { name: "Quitar" }).click()
    await expect(application.page.getByText("Selección en curso")).toBeVisible()
    await expect(application.page.getByText("Falta definir la principal")).toBeVisible()
    await expect(application.page.getByText("Selección lista", { exact: true })).toHaveCount(0)
    await application.page.getByRole("button", { name: "Hacer principal" }).first().click()

    await application.reopen()
    await expect(application.page.getByText("Sesión lista para edición")).toBeVisible()
    await expect(application.page.getByText("2 de 3 seleccionadas")).toBeVisible()
  } finally {
    await application.close()
  }
})
