import { expect, test } from "@playwright/test"

import { TestApplication } from "./support/test-application.js"

async function preparePrincipal(application: TestApplication): Promise<{ captureId: string; baseName: string }> {
  await application.page.getByLabel("Nombre del evento").fill("Boda RAW")
  await application.page.getByRole("button", { name: "Crear evento" }).click()
  await application.page.getByRole("button", { name: "Iniciar sesión fotográfica" }).click()
  await application.page.getByRole("button", { name: "Iniciar serie" }).click()
  await application.page.getByRole("button", { name: "Simular captura RAW + JPEG" }).click()
  await application.page.getByRole("button", { name: "Cerrar serie" }).click()
  await application.page.getByRole("button", { name: "Seleccionar", exact: true }).click()
  await application.page.getByRole("button", { name: "Marcar principal" }).click()
  const state = await application.state()
  const capture = state.events[0].sessions[0].series[0].captures[0]
  return { captureId: capture.id, baseName: capture.baseName }
}

async function setRawCondition(application: TestApplication, captureId: string, condition: "missing" | "corrupt" | "unsupported" | "valid") {
  await application.page.evaluate(async ({ id, value }) => {
    await fetch(`/api/test/captures/${id}/raw-condition`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ condition: value }),
    })
  }, { id: captureId, value: condition })
}

test("revela el RAW local y conserva la asociación de originales", async ({ browser }) => {
  const application = await TestApplication.start(browser, "smartstudio-raw-valid-", { testFeatures: true })
  try {
    const { baseName } = await preparePrincipal(application)
    const before = await application.state()
    const captureBefore = before.events[0].sessions[0].series[0].captures[0]
    await application.page.getByRole("button", { name: "Finalizar sesión fotográfica" }).click()
    const card = application.page.getByTestId(`editing-job-${baseName}`)
    await expect(card.getByText("Procesada desde RAW", { exact: true })).toBeVisible()
    const after = await application.state()
    expect(after.editingJobs[0].origin).toBe("raw")
    const captureAfter = after.events[0].sessions[0].series[0].captures[0]
    expect(captureAfter.rawSha256).toBe(captureBefore.rawSha256)
    expect(captureAfter.jpegSha256).toBe(captureBefore.jpegSha256)
  } finally {
    await application.close()
  }
})

test("un RAW corrupto permite rechazar procesar desde JPEG sin fabricar resultado", async ({ browser }) => {
  const application = await TestApplication.start(browser, "smartstudio-raw-corrupt-", { testFeatures: true })
  try {
    const { captureId, baseName } = await preparePrincipal(application)
    await setRawCondition(application, captureId, "corrupt")
    const before = await application.state()
    const rawPath = before.events[0].sessions[0].series[0].captures[0].rawRelativePath!
    const original = await application.readDataFile(rawPath)
    await application.page.getByRole("button", { name: "Finalizar sesión fotográfica" }).click()
    const card = application.page.getByTestId(`editing-job-${baseName}`)
    await expect(card.getByText("Requiere decisión JPEG", { exact: true })).toBeVisible()
    await expect(card.getByText("corrupto o incompleto", { exact: false })).toBeVisible()
    await card.getByRole("button", { name: "No procesar desde JPEG" }).click()
    await expect(card.getByText("JPEG rechazado", { exact: true })).toBeVisible()
    expect((await application.state()).editingJobs[0].previewRelativePath).toBeNull()
    expect(await application.readDataFile(rawPath)).toEqual(original)
    await setRawCondition(application, captureId, "valid")
    await card.getByRole("button", { name: "Reintentar RAW corregido" }).click()
    await expect(card.getByText("Procesada desde RAW", { exact: true })).toBeVisible()
    expect((await application.state()).editingJobs[0].origin).toBe("raw")
  } finally {
    await application.close()
  }
})

test("RAW incompatible o ausente requieren autorización JPEG explícita", async ({ browser }) => {
  for (const condition of ["unsupported", "missing"] as const) {
    const application = await TestApplication.start(browser, `smartstudio-raw-${condition}-`, { testFeatures: true })
    try {
      const { captureId, baseName } = await preparePrincipal(application)
      await setRawCondition(application, captureId, condition)
      await application.page.getByRole("button", { name: "Finalizar sesión fotográfica" }).click()
      const card = application.page.getByTestId(`editing-job-${baseName}`)
      await expect(card.getByText("Requiere decisión JPEG", { exact: true })).toBeVisible()
      await card.getByRole("button", { name: "Autorizar procesar desde JPEG" }).click()
      await expect(card.getByText("Procesada desde JPEG", { exact: true })).toBeVisible()
      const job = (await application.state()).editingJobs[0]
      expect(job.origin).toBe("jpeg")
      expect(job.jpegFallbackDecision).toBe("authorized")
    } finally {
      await application.close()
    }
  }
})
