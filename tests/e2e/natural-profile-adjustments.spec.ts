import { createHash } from "node:crypto"
import { expect, test } from "@playwright/test"

import { TestApplication } from "./support/test-application.js"

async function begin(application: TestApplication) {
  await application.page.getByLabel("Nombre del evento").fill("Perfil natural")
  await application.page.getByRole("button", { name: "Crear evento" }).click()
}

async function completeSimulation(application: TestApplication): Promise<string> {
  await application.page.getByRole("button", { name: "Iniciar sesión fotográfica" }).click()
  await application.page.getByRole("button", { name: "Iniciar serie" }).click()
  await application.page.getByRole("button", { name: "Simular captura RAW + JPEG" }).click()
  await expect(application.page.getByText("RAW + JPEG asociados", { exact: false })).toBeVisible()
  const state = await application.state()
  const event = state.events.find((item) => item.id === state.activeEventId)!
  const capture = event.sessions.find((session) => session.status === "active")!.series[0].captures[0]
  await application.page.getByRole("button", { name: "Cerrar serie" }).click()
  await application.page.getByRole("button", { name: "Seleccionar", exact: true }).click()
  await application.page.getByRole("button", { name: "Marcar principal" }).click()
  await application.page.getByRole("button", { name: "Finalizar sesión fotográfica" }).click()
  await expect(application.page.getByTestId(`editing-job-${capture.baseName}`).getByText("Lista para revisar", { exact: true })).toBeVisible()
  return capture.baseName
}

const digest = (contents: Buffer) => createHash("sha256").update(contents).digest("hex")

test("aplica ajustes acotados y restablece el perfil Natural", async ({ browser }) => {
  const application = await TestApplication.start(browser, "smartstudio-natural-adjustments-", { testFeatures: true })
  try {
    await begin(application)
    const baseName = await completeSimulation(application)
    const card = application.page.getByTestId(`editing-job-${baseName}`)
    await expect(card.getByText("Perfil: Natural de evento v1", { exact: true })).toBeVisible()
    const initialJob = (await application.state()).editingJobs[0]
    const initialDigest = digest(await application.readDataFile(initialJob.previewRelativePath!))

    await card.getByLabel("Exposición").fill("0.7")
    await card.getByLabel("Temperatura").fill("-0.4")
    await card.getByLabel("Intensidad de color").fill("0.5")
    await card.getByLabel("Suavizado de piel").fill("2")
    await card.getByRole("button", { name: "Aplicar ajustes" }).click()
    await expect.poll(async () => (await application.state()).editingJobs[0].attempts).toBe(2)
    await expect.poll(async () => (await application.state()).editingJobs[0].status).toBe("review")
    const adjustedJob = (await application.state()).editingJobs[0]
    expect(adjustedJob.adjustments).toEqual({ exposure: 0.7, temperature: -0.4, colorIntensity: 0.5, skinSmoothing: 2 })
    expect(digest(await application.readDataFile(adjustedJob.previewRelativePath!))).not.toBe(initialDigest)

    await card.getByRole("button", { name: "Restablecer edición automática" }).click()
    await expect.poll(async () => (await application.state()).editingJobs[0].attempts).toBe(3)
    await expect.poll(async () => (await application.state()).editingJobs[0].status).toBe("review")
    expect((await application.state()).editingJobs[0].adjustments).toEqual({ exposure: 0, temperature: 0, colorIntensity: 0, skinSmoothing: 1 })
  } finally {
    await application.close()
  }
})

test("el perfil futuro no altera trabajos existentes y advierte condiciones no controladas", async ({ browser }) => {
  const application = await TestApplication.start(browser, "smartstudio-natural-profile-version-", { testFeatures: true, path: "/?quality-fixtures" })
  try {
    await begin(application)
    const firstBaseName = await completeSimulation(application)
    await application.page.getByRole("button", { name: "Nueva versión del perfil" }).click()
    const secondBaseName = await completeSimulation(application)
    const state = await application.state()
    expect(state.editingJobs.map((job) => job.profile.version)).toEqual([1, 2])
    await expect(application.page.getByTestId(`editing-job-${firstBaseName}`).getByText("Perfil: Natural de evento v1", { exact: true })).toBeVisible()
    await expect(application.page.getByTestId(`editing-job-${secondBaseName}`).getByText("Perfil: Natural de evento v2", { exact: true })).toBeVisible()
    const firstCard = application.page.getByTestId(`editing-job-${firstBaseName}`)
    await firstCard.getByRole("button", { name: "Reprocesar con perfil v2" }).click()
    await expect.poll(async () => (await application.state()).editingJobs[0].versions.length).toBe(2)
    expect((await application.state()).editingJobs[0].profile.version).toBe(2)
    expect((await application.state()).editingJobs[0].versions[1].profile.version).toBe(2)

    await application.page.getByRole("button", { name: "Iniciar sesión fotográfica" }).click()
    await application.page.getByRole("button", { name: "Iniciar serie" }).click()
    await application.page.getByRole("button", { name: "Cargar fotografías controladas" }).click()
    await application.page.getByRole("button", { name: "Cerrar serie" }).click()
    const exposureCard = application.page.getByTestId(/capture-.*005$/)
    await exposureCard.getByRole("button", { name: "Seleccionar", exact: true }).click()
    await exposureCard.getByRole("button", { name: "Marcar principal" }).click()
    await application.page.getByRole("button", { name: "Finalizar sesión fotográfica" }).click()
    await expect(application.page.getByText("Condiciones fuera del miniestudio controlado", { exact: true })).toBeVisible()
  } finally {
    await application.close()
  }
})
