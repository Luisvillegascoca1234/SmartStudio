import { expect, test } from "@playwright/test"
import sharp from "sharp"

import { TestApplication } from "./support/test-application.js"

const plate = async (colour: string, width = 900, height = 600): Promise<Buffer> =>
  sharp({ create: { width, height, channels: 3, background: colour } }).png().toBuffer()

test("registra, versiona y recupera una placa limpia inmutable por evento", async ({ browser }) => {
  const application = await TestApplication.start(browser, "smartstudio-clean-plate-", {
    testFeatures: true,
    controlledCleanPlatePersonDetected: false,
  })
  try {
    await application.page.getByLabel("Nombre del evento").fill("Evento con fondo")
    await application.page.getByRole("button", { name: "Crear evento" }).click()

    const input = application.page.getByLabel("Placa limpia")
    await input.setInputFiles({ name: "fondo-uno.png", mimeType: "image/png", buffer: await plate("#718a91") })
    await application.page.getByRole("button", { name: "Validar placa" }).click()
    await expect(application.page.getByText("Validada · 1 versión")).toBeVisible()

    const first = (await application.state()).events[0].cleanPlates[0]
    expect(first).toMatchObject({ width: 900, height: 600, validationMethod: "controlled-fixture", supersedesId: null })
    expect(await application.readDataFile(first.relativePath)).toEqual(await plate("#718a91"))

    await input.setInputFiles({ name: "fondo-dos.png", mimeType: "image/png", buffer: await plate("#879ca2") })
    await application.page.getByRole("button", { name: "Validar placa" }).click()
    await expect(application.page.getByText("Validada · 2 versiones")).toBeVisible()
    const updated = (await application.state()).events[0]
    expect(updated.cleanPlates[1].supersedesId).toBe(first.id)
    expect(updated.activeCleanPlateId).toBe(updated.cleanPlates[1].id)
    expect(await application.readDataFile(first.relativePath)).toEqual(await plate("#718a91"))

    await application.reopen()
    const recovered = (await application.state()).events[0]
    expect(recovered.activeCleanPlateId).toBe(updated.activeCleanPlateId)
    await expect(application.page.getByText("Validada · 2 versiones")).toBeVisible()
  } finally {
    await application.close()
  }
})

test("rechaza placas pequeñas o con personas sin afectar el evento", async ({ browser }) => {
  const smallApplication = await TestApplication.start(browser, "smartstudio-small-plate-", {
    testFeatures: true,
    controlledCleanPlatePersonDetected: false,
  })
  try {
    await smallApplication.page.getByLabel("Nombre del evento").fill("Placa inválida")
    await smallApplication.page.getByRole("button", { name: "Crear evento" }).click()
    await smallApplication.page.getByLabel("Placa limpia").setInputFiles({ name: "pequena.png", mimeType: "image/png", buffer: await plate("#777777", 320, 240) })
    await smallApplication.page.getByRole("button", { name: "Validar placa" }).click()
    await expect(smallApplication.page.getByRole("alert")).toContainText("640 × 480")
    expect((await smallApplication.state()).events[0].cleanPlates).toEqual([])
  } finally {
    await smallApplication.close()
  }

  const personApplication = await TestApplication.start(browser, "smartstudio-person-plate-", {
    testFeatures: true,
    controlledCleanPlatePersonDetected: true,
  })
  try {
    await personApplication.page.getByLabel("Nombre del evento").fill("Placa con persona")
    await personApplication.page.getByRole("button", { name: "Crear evento" }).click()
    await personApplication.page.getByLabel("Placa limpia").setInputFiles({ name: "persona.png", mimeType: "image/png", buffer: await plate("#777777") })
    await personApplication.page.getByRole("button", { name: "Validar placa" }).click()
    await expect(personApplication.page.getByRole("alert")).toContainText("contiene una persona")
    expect((await personApplication.state()).events[0].cleanPlates).toEqual([])
  } finally {
    await personApplication.close()
  }
})
