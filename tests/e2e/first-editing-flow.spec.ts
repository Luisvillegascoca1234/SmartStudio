import { expect, test } from "@playwright/test"

import { TestApplication } from "./support/test-application.js"

test("la fotografía principal recibe una primera edición local que el operador puede aprobar", async ({ browser }) => {
  const application = await TestApplication.start(browser, "smartstudio-editing-e2e-", { testFeatures: true })

  try {
    await application.page.getByLabel("Nombre del evento").fill("Boda con edición")
    await application.page.getByRole("button", { name: "Crear evento" }).click()
    await application.page.getByRole("button", { name: "Iniciar sesión fotográfica" }).click()
    await application.page.getByRole("button", { name: "Iniciar serie" }).click()
    await application.page.getByRole("button", { name: "Simular captura RAW + JPEG" }).click()
    await application.page.getByRole("button", { name: "Cerrar serie" }).click()
    await application.page.getByRole("button", { name: "Seleccionar", exact: true }).click()
    await application.page.getByRole("button", { name: "Marcar principal" }).click()

    const stateBeforeEditing = await application.state()
    const originalCapture = stateBeforeEditing.events[0].sessions[0].series[0].captures[0]
    expect(originalCapture.jpegRelativePath).not.toBeNull()
    expect(originalCapture.rawRelativePath).not.toBeNull()
    const originalBefore = await application.readDataFile(originalCapture.jpegRelativePath!)
    const rawBefore = await application.readDataFile(originalCapture.rawRelativePath!)

    await application.page.getByRole("button", { name: "Finalizar sesión fotográfica" }).click()
    const editingCard = application.page.getByTestId(`editing-job-${originalCapture.baseName}`)
    await expect(editingCard).toBeVisible()
    await expect(editingCard.getByText("En cola", { exact: true })).toBeVisible()
    await expect(editingCard.getByText("Procesando", { exact: true })).toBeVisible()
    await expect(editingCard.getByText("Lista para revisar", { exact: true })).toBeVisible()
    await expect(editingCard.getByAltText(`Original ${originalCapture.baseName}`)).toBeVisible()
    await expect(editingCard.getByAltText(`Edición ${originalCapture.baseName}`)).toBeVisible()
    await editingCard.getByRole("button", { name: "Ver original" }).click()
    await expect(editingCard.getByAltText(`Edición ${originalCapture.baseName}`)).toBeHidden()
    await editingCard.getByRole("button", { name: "Ver edición" }).click()
    await expect(editingCard.getByAltText(`Original ${originalCapture.baseName}`)).toBeHidden()
    await editingCard.getByLabel("Ampliación").fill("2")
    await editingCard.getByLabel("Desplazamiento horizontal").fill("15")
    await editingCard.getByLabel("Desplazamiento vertical").fill("-10")
    await editingCard.getByRole("button", { name: "Vista dividida" }).click()
    await expect(editingCard.getByAltText(`Original ${originalCapture.baseName}`)).toBeVisible()
    await expect(editingCard.getByAltText(`Edición ${originalCapture.baseName}`)).toBeVisible()

    const stateWithPreview = await application.state()
    const editingJob = stateWithPreview.editingJobs[0]
    expect(editingJob.previewRelativePath).not.toBeNull()
    expect(editingJob.status).toBe("review")
    const editedPreview = await application.readDataFile(editingJob.previewRelativePath!)
    expect(editedPreview.equals(originalBefore)).toBe(false)
    expect((await application.readDataFile(originalCapture.jpegRelativePath!)).equals(originalBefore)).toBe(true)
    expect((await application.readDataFile(originalCapture.rawRelativePath!)).equals(rawBefore)).toBe(true)

    await application.page.getByRole("button", { name: "Iniciar sesión fotográfica" }).click()
    await expect(application.page.getByRole("button", { name: "Iniciar serie" })).toBeVisible()
    await editingCard.getByRole("button", { name: "Aprobar edición" }).click()
    await expect(editingCard.getByText("Edición aprobada", { exact: true }).first()).toBeVisible()

    const approvedState = await application.state()
    expect(approvedState.editingJobs[0].status).toBe("approved")
    expect(approvedState.events[0].sessions[1].status).toBe("active")

    await application.page.getByRole("button", { name: "Cancelar sesión fotográfica" }).click()
    await expect(application.page.getByText("Finalizada · Edición aprobada", { exact: false })).toBeVisible()
  } finally {
    await application.close()
  }
})
