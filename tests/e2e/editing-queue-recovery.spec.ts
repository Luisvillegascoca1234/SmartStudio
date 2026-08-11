import { expect, test } from "@playwright/test"

import { TestApplication } from "./support/test-application.js"

async function createEvent(application: TestApplication, name: string): Promise<void> {
  await application.page.getByLabel("Nombre del evento").fill(name)
  await application.page.getByRole("button", { name: "Crear evento" }).click()
}

async function completeSelectedSession(application: TestApplication): Promise<string> {
  await application.page.getByRole("button", { name: "Iniciar sesión fotográfica" }).click()
  await application.page.getByRole("button", { name: "Iniciar serie" }).click()
  await application.page.getByRole("button", { name: "Simular captura RAW + JPEG" }).click()
  await expect(application.page.getByText("RAW + JPEG asociados", { exact: false })).toBeVisible()
  const state = await application.state()
  const activeEvent = state.events.find((event) => event.id === state.activeEventId)!
  const session = activeEvent.sessions.find((item) => item.status === "active")!
  const baseName = session.series[0].captures[0].baseName
  await application.page.getByRole("button", { name: "Cerrar serie" }).click()
  await application.page.getByRole("button", { name: "Seleccionar", exact: true }).click()
  await application.page.getByRole("button", { name: "Marcar principal" }).click()
  await application.page.getByRole("button", { name: "Finalizar sesión fotográfica" }).click()
  return baseName
}

test("procesa en orden y permite cancelar sin convertirlo en reintento técnico", async ({ browser }) => {
  const application = await TestApplication.start(browser, "smartstudio-editing-queue-", {
    testFeatures: true,
    editingProcessingDelayMilliseconds: 3_000,
  })

  try {
    await createEvent(application, "Boda con cola")
    const firstBaseName = await completeSelectedSession(application)
    const firstCard = application.page.getByTestId(`editing-job-${firstBaseName}`)
    await expect(firstCard.getByText("Procesando", { exact: true })).toBeVisible()

    const secondBaseName = await completeSelectedSession(application)
    const secondCard = application.page.getByTestId(`editing-job-${secondBaseName}`)
    await expect(secondCard.getByText("En cola", { exact: true })).toBeVisible()

    await firstCard.getByRole("button", { name: "Cancelar edición" }).click()
    await expect(firstCard.getByText("Cancelado", { exact: true })).toBeVisible()
    await expect(secondCard.getByText("Procesando", { exact: true })).toBeVisible()

    await expect(firstCard.getByRole("button", { name: "Reintentar edición" })).toHaveCount(0)
    const cancelledRetryStatus = await application.page.evaluate(async (jobId) => (
      await fetch(`/api/editing/${jobId}/retry`, { method: "POST" })
    ).status, (await application.state()).editingJobs[0].id)
    expect(cancelledRetryStatus).toBe(409)
    await expect(secondCard.getByText("Lista para revisar", { exact: true })).toBeVisible()

    const completed = await application.state()
    expect(completed.editingJobs.map((job) => job.status)).toEqual(["cancelled", "review"])
    expect(completed.editingJobs.map((job) => job.attempts)).toEqual([1, 1])
  } finally {
    await application.close()
  }
})

test("recupera fallos e interrupciones y termina trabajos de un evento cerrado", async ({ browser }) => {
  const application = await TestApplication.start(browser, "smartstudio-editing-recovery-", {
    testFeatures: true,
    editingProcessingDelayMilliseconds: 1_000,
  })

  try {
    await createEvent(application, "Boda recuperable")
    await application.page.evaluate(async () => fetch("/api/test/editing/fail-next", { method: "POST" }))
    const baseName = await completeSelectedSession(application)
    const editingCard = application.page.getByTestId(`editing-job-${baseName}`)
    await expect(editingCard.getByText("Falló", { exact: true })).toBeVisible()
    await expect(editingCard.getByText("Fallo controlado de edición.")).toBeVisible()

    await editingCard.getByRole("button", { name: "Reintentar edición" }).click()
    await expect(editingCard.getByText("Lista para revisar", { exact: true })).toBeVisible()
    let state = await application.state()
    const jobId = state.editingJobs[0].id

    await application.page.evaluate(async (id) => {
      await fetch(`/api/test/editing/${id}/interrupt`, { method: "POST" })
    }, jobId)
    await application.reopen()
    const recoveredEditingCard = application.page.getByTestId(`editing-job-${baseName}`)
    await expect(recoveredEditingCard.getByText("Interrumpido", { exact: true })).toBeVisible()

    await recoveredEditingCard.getByRole("button", { name: "Reintentar edición" }).click()
    await expect(recoveredEditingCard.getByText("Procesando", { exact: true })).toBeVisible()
    await application.page.getByRole("button", { name: "Cerrar evento" }).click()
    await expect(application.page.getByText("Eventos anteriores")).toBeVisible()
    await expect.poll(async () => (await application.state()).editingJobs[0].status).toBe("review")
    const closedReprocessStatus = await application.page.evaluate(async (id) => {
      const response = await fetch(`/api/editing/${id}/reprocess`, { method: "POST" })
      return response.status
    }, jobId)
    expect(closedReprocessStatus).toBe(409)

    await application.page.getByRole("button", { name: "Reabrir evento" }).click()
    await expect(recoveredEditingCard.getByText("Lista para revisar", { exact: true })).toBeVisible()
    state = await application.state()
    expect(state.editingJobs[0].attempts).toBe(3)
  } finally {
    await application.close()
  }
})
