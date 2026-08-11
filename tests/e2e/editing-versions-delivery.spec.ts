import { expect, test } from "@playwright/test"
import sharp from "sharp"

import { TestApplication } from "./support/test-application.js"

async function prepare(application: TestApplication, captures = 1) {
  await application.page.getByLabel("Nombre del evento").fill("Versiones")
  await application.page.getByRole("button", { name: "Crear evento" }).click()
  await application.page.getByRole("button", { name: "Iniciar sesión fotográfica" }).click()
  await application.page.getByRole("button", { name: "Iniciar serie" }).click()
  for (let index = 0; index < captures; index += 1) await application.page.getByRole("button", { name: "Simular captura RAW + JPEG" }).click()
  await expect(application.page.getByText("RAW + JPEG asociados", { exact: false })).toHaveCount(captures)
  const state = await application.state()
  const session = state.events[0].sessions[0]
  await application.page.getByRole("button", { name: "Cerrar serie" }).click()
  const cards = session.series[0].captures.map((capture) => application.page.getByTestId(`capture-${capture.baseName}`))
  for (const card of cards) await card.getByRole("button", { name: "Seleccionar", exact: true }).click()
  await cards[0].getByRole("button", { name: "Marcar principal" }).click()
  await application.page.getByRole("button", { name: "Finalizar sesión fotográfica" }).click()
  await expect(application.page.getByText("Versión 1", { exact: false }).first()).toBeVisible()
  return session.series[0].captures
}

test("conserva aprobación, revocación, alternativa y cambio de principal", async ({ browser }) => {
  const application = await TestApplication.start(browser, "smartstudio-versions-", { testFeatures: true })
  try {
    const captures = await prepare(application, 2)
    let state = await application.state()
    const firstJob = state.editingJobs[0]
    const card = application.page.getByTestId(`editing-job-${captures[0].baseName}`)
    await card.getByRole("button", { name: "Aprobar edición" }).click()
    await expect(card.getByText("Aprobada vigente", { exact: true })).toBeVisible()
    await expect.poll(async () => (await application.state()).editingJobs[0].versions[0].deliveryStatus).toBe("ready")
    const approvedDeliveryPath = (await application.state()).editingJobs[0].versions[0].fullRelativePath!
    await card.getByRole("button", { name: "Revocar aprobación" }).click()
    const revokedJob = (await application.state()).editingJobs[0]
    expect(revokedJob.approvedVersionId).toBeNull()
    expect(revokedJob.versions[0].deliveryStatus).toBe("ready")
    expect(revokedJob.versions[0].fullRelativePath).toBe(approvedDeliveryPath)
    expect((await application.readDataFile(approvedDeliveryPath)).length).toBeGreaterThan(0)
    await card.getByRole("button", { name: "Aprobar versión 1" }).click()
    await card.getByRole("button", { name: "Revocar aprobación" }).click()
    await card.getByRole("button", { name: "Rechazar y conservar original" }).click()
    await expect(card.getByText("Edición rechazada", { exact: true }).first()).toBeVisible()
    await expect.poll(async () => (await application.state()).editingJobs[0].versions[0].deliveryStatus).toBe("not-requested")
    expect((await application.state()).editingJobs[0].versions[0].fullRelativePath).toBeNull()

    await card.getByRole("button", { name: "Procesar alternativa" }).click()
    await expect.poll(async () => (await application.state()).editingJobs.length).toBe(2)
    const alternativeCard = application.page.getByTestId(`editing-job-${captures[1].baseName}`)
    await expect(alternativeCard).toBeVisible()
    await expect(alternativeCard.getByText("Lista para revisar", { exact: true })).toBeVisible()
    await card.getByRole("button", { name: "Usar como principal" }).click()
    state = await application.state()
    expect(state.editingJobs[0].approvedVersionId).toBeNull()
    expect(state.events[0].sessions[0].series[0].captures.find((capture) => capture.id === captures[1].id)?.principal).toBe(true)
    await alternativeCard.getByRole("button", { name: "Aprobar edición" }).click()
    await expect(application.page.getByText("Finalizada · Edición aprobada", { exact: false })).toBeVisible()
    await application.reopen()
    state = await application.state()
    expect(state.editingJobs[0].versions).toHaveLength(1)
    expect(state.editingJobs).toHaveLength(2)
    expect(firstJob.profile.name).toBe("Evento pulido")
  } finally {
    await application.close()
  }
})

test("revocar durante la generación cancela una entrega que todavía no existe", async ({ browser }) => {
  const application = await TestApplication.start(browser, "smartstudio-revoke-generating-", { testFeatures: true, editingDeliveryDelayMilliseconds: 3_000 })
  try {
    const [capture] = await prepare(application)
    const card = application.page.getByTestId(`editing-job-${capture.baseName}`)
    await card.getByRole("button", { name: "Aprobar edición" }).click()
    await expect.poll(async () => (await application.state()).editingJobs[0].versions[0].deliveryStatus).toBe("generating")
    await card.getByRole("button", { name: "Revocar aprobación" }).click()
    await expect.poll(async () => (await application.state()).editingJobs[0].versions[0].deliveryStatus).toBe("not-requested")
    await application.page.waitForTimeout(3_000)
    const revoked = (await application.state()).editingJobs[0]
    expect(revoked.status).toBe("review")
    expect(revoked.approvedVersionId).toBeNull()
    expect(revoked.versions[0].fullRelativePath).toBeNull()
    expect(revoked.versions[0].deliveryStatus).toBe("not-requested")
  } finally {
    await application.close()
  }
})

test("genera, valida y reintenta el JPEG sRGB completo sin metadatos sensibles", async ({ browser }) => {
  const application = await TestApplication.start(browser, "smartstudio-delivery-", { testFeatures: true })
  try {
    const [capture] = await prepare(application)
    await application.page.evaluate(async () => fetch("/api/test/editing/fail-next-delivery", { method: "POST" }))
    const card = application.page.getByTestId(`editing-job-${capture.baseName}`)
    await card.getByRole("button", { name: "Aprobar edición" }).click()
    await expect(card.getByText("JPEG completo pendiente", { exact: true })).toBeVisible()
    await card.getByRole("button", { name: "Reintentar JPEG completo" }).click()
    await expect(card.getByText("Edición aprobada y lista para entrega", { exact: true })).toBeVisible()
    const state = await application.state()
    const version = state.editingJobs[0].versions[0]
    expect(version.deliveryStatus).toBe("ready")
    expect(version.fullRelativePath).not.toBeNull()
    const metadata = await sharp(await application.readDataFile(version.fullRelativePath!)).metadata()
    const previewMetadata = await sharp(await application.readDataFile(version.previewRelativePath)).metadata()
    expect(metadata.format).toBe("jpeg")
    expect(metadata.space).toBe("srgb")
    expect(metadata.width).toBe(version.width)
    expect(metadata.height).toBe(version.height)
    expect(metadata.width).toBeGreaterThan(previewMetadata.width!)
    expect(metadata.height).toBeGreaterThan(previewMetadata.height!)
    expect(metadata.exif).toBeUndefined()
  } finally {
    await application.close()
  }
})
