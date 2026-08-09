import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { expect, test } from "@playwright/test"
import sharp from "sharp"

import type { EditingEngine, EditingRenderResult } from "../../src/server/editing-engine.js"
import type { Capture, EditingJob } from "../../src/shared/workflow.js"
import type { AdobeReadiness } from "../../src/shared/operations.js"
import { TestApplication } from "./support/test-application.js"

type Scenario = "success" | "late-success" | "hang-until-abort" | "process-error" | "invalid-output" | "wrong-association"

const readyAdobe = async (): Promise<AdobeReadiness> => ({
  status: "ready",
  checkedAt: new Date().toISOString(),
  checks: [
    { id: "photoshop", label: "Photoshop estable", ready: true, detail: "controlado" },
    { id: "camera-raw", label: "Adobe Camera Raw", ready: true, detail: "controlado" },
    { id: "preset", label: "Preset seleccionado", ready: true, detail: "controlado" },
    { id: "droplet", label: "Droplet de Photoshop", ready: true, detail: "controlado" },
    { id: "action", label: "Action de Photoshop", ready: true, detail: "controlado" },
    { id: "exchange", label: "Carpetas de intercambio", ready: true, detail: "controlado" },
    { id: "offline-resources", label: "Recursos offline", ready: true, detail: "controlado" },
  ],
})

class ScenarioAdobeEngine implements EditingEngine {
  readonly id = "adobe" as const
  readonly outputStrategy = "full-once" as const

  constructor(private readonly dataDirectory: string, private readonly scenarios: Scenario[]) {}

  async render(
    _job: EditingJob,
    capture: Capture,
    destination: string,
    _origin: "raw" | "jpeg",
    _lightweight: boolean,
    signal?: AbortSignal,
  ): Promise<EditingRenderResult> {
    const scenario = this.scenarios.shift() ?? "success"
    if (scenario === "process-error") throw new Error("Photoshop terminó con un error de proceso controlado.")
    if (scenario === "wrong-association") throw new Error("La salida pertenece a otro trabajo controlado.")
    if (scenario === "hang-until-abort") {
      await new Promise<void>((_resolve, reject) => {
        signal?.addEventListener("abort", () => reject(new Error("Proceso Adobe abortado.")), { once: true })
      })
    }
    if (scenario === "late-success") await new Promise((resolve) => setTimeout(resolve, 3_000))
    await mkdir(path.dirname(destination), { recursive: true })
    if (scenario === "invalid-output") await writeFile(destination, "salida Adobe incompleta", "utf8")
    else {
      await sharp(path.join(this.dataDirectory, capture.jpegRelativePath!))
        .rotate()
        .toColourspace("srgb")
        .jpeg({ quality: 92 })
        .toFile(destination)
    }
    return {
      lensCorrectionApplied: true,
      portraitResult: { faces: 0, treated: 0, eyesEnhanced: false, teethWhitened: false, warnings: [], backdrop: "unchanged", backdropDiagnostics: null },
      processingRoute: "cpu",
      usedRawFallback: false,
    }
  }
}

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
  const event = state.events.find((item) => item.id === state.activeEventId)!
  const session = event.sessions.find((item) => item.status === "active")!
  const baseName = session.series[0].captures[0].baseName
  await application.page.getByRole("button", { name: "Cerrar serie" }).click()
  await application.page.getByRole("button", { name: "Seleccionar", exact: true }).click()
  await application.page.getByRole("button", { name: "Marcar principal" }).click()
  await application.page.getByRole("button", { name: "Finalizar sesión fotográfica" }).click()
  return baseName
}

test("advierte demora, interrumpe por timeout y aísla una salida Adobe tardía", async ({ browser }) => {
  const scenarios: Scenario[] = ["late-success", "success"]
  const application = await TestApplication.start(browser, "smartstudio-adobe-timeout-", {
    testFeatures: true,
    editingEngineFactory: (directory) => new ScenarioAdobeEngine(directory, scenarios),
    adobeReadinessProvider: readyAdobe,
    editingProcessingDelayMilliseconds: 0,
    editingTimeoutMilliseconds: 2_000,
    editingDelayWarningMilliseconds: 100,
  })
  try {
    await createEvent(application, "Adobe tardío")
    const baseName = await completeSelectedSession(application)
    const card = application.page.getByTestId(`editing-job-${baseName}`)
    await expect(card.getByText("La vista previa tarda más de 30 segundos", { exact: true })).toBeVisible()
    await application.page.getByRole("button", { name: "Iniciar sesión fotográfica" }).click()
    await expect(application.page.getByRole("button", { name: "Iniciar serie" })).toBeVisible()
    await application.page.getByRole("button", { name: "Cancelar sesión fotográfica" }).click()
    await expect(card.getByText("Interrumpido", { exact: true })).toBeVisible()
    await expect.poll(async () => (await application.state()).editingJobs[0].metrics.lateOutputs).toBeGreaterThan(0)
    let state = await application.state()
    expect(state.editingJobs[0].versions).toHaveLength(0)
    expect(state.editingJobs[0].metrics.timeouts).toBe(1)
    expect(state.editingJobs[0].metrics.delays).toBe(1)
    expect((await application.listDataFiles("adobe-exchange/quarantine")).length).toBeGreaterThan(0)

    await card.getByRole("button", { name: "Reintentar edición" }).click()
    await expect(card.getByText("Lista para revisar", { exact: true })).toBeVisible()
    state = await application.state()
    expect(state.editingJobs[0].versions).toHaveLength(1)
    expect(state.editingJobs[0].attempts).toBe(2)
    expect(state.editingJobs[0].metrics.retries).toBe(1)
  } finally {
    await application.close()
  }
})

test("cancela un Adobe bloqueado, continúa la cola y reintenta sin versiones duplicadas", async ({ browser }) => {
  const scenarios: Scenario[] = ["hang-until-abort", "success", "success"]
  const application = await TestApplication.start(browser, "smartstudio-adobe-cancel-", {
    testFeatures: true,
    editingEngineFactory: (directory) => new ScenarioAdobeEngine(directory, scenarios),
    adobeReadinessProvider: readyAdobe,
    editingProcessingDelayMilliseconds: 0,
    editingTimeoutMilliseconds: 5_000,
  })
  try {
    await createEvent(application, "Adobe cancelable")
    const first = await completeSelectedSession(application)
    const firstCard = application.page.getByTestId(`editing-job-${first}`)
    await expect(firstCard.getByText("Procesando", { exact: true })).toBeVisible()
    const second = await completeSelectedSession(application)
    const secondCard = application.page.getByTestId(`editing-job-${second}`)
    await expect(secondCard.getByText("En cola", { exact: true })).toBeVisible()
    await firstCard.getByRole("button", { name: "Cancelar edición" }).click()
    await expect(firstCard.getByText("Cancelado", { exact: true })).toBeVisible()
    await expect(secondCard.getByText("Lista para revisar", { exact: true })).toBeVisible()
    await firstCard.getByRole("button", { name: "Reintentar edición" }).click()
    await expect(firstCard.getByText("Lista para revisar", { exact: true })).toBeVisible()
    const state = await application.state()
    expect(state.editingJobs.map((job) => job.versions.length)).toEqual([1, 1])
    expect(state.editingJobs.map((job) => job.attempts)).toEqual([2, 1])
  } finally {
    await application.close()
  }
})

test("recupera error, archivo inválido, asociación ajena y reinicio Adobe", async ({ browser }) => {
  const scenarios: Scenario[] = ["process-error", "invalid-output", "wrong-association", "success", "success"]
  const application = await TestApplication.start(browser, "smartstudio-adobe-errors-", {
    testFeatures: true,
    editingEngineFactory: (directory) => new ScenarioAdobeEngine(directory, scenarios),
    adobeReadinessProvider: readyAdobe,
    editingProcessingDelayMilliseconds: 0,
  })
  try {
    await createEvent(application, "Adobe recuperable")
    const baseName = await completeSelectedSession(application)
    const card = application.page.getByTestId(`editing-job-${baseName}`)
    for (const expected of ["error de proceso", "Input file", "otro trabajo"]) {
      await expect(card.getByText("Falló", { exact: true })).toBeVisible()
      await expect(card.getByText(expected, { exact: false })).toBeVisible()
      await card.getByRole("button", { name: "Reintentar edición" }).click()
    }
    await expect(card.getByText("Lista para revisar", { exact: true })).toBeVisible()
    let state = await application.state()
    expect(state.editingJobs[0].versions).toHaveLength(1)
    const jobId = state.editingJobs[0].id
    await application.page.evaluate(async (id) => fetch(`/api/test/editing/${id}/interrupt`, { method: "POST" }), jobId)
    await application.reopen()
    const recoveredCard = application.page.getByTestId(`editing-job-${baseName}`)
    await expect(recoveredCard.getByText("Interrumpido", { exact: true })).toBeVisible()
    await recoveredCard.getByRole("button", { name: "Reintentar edición" }).click()
    await expect(recoveredCard.getByText("Lista para revisar", { exact: true })).toBeVisible()
    state = await application.state()
    expect(state.editingJobs[0].versions).toHaveLength(2)
    expect(state.editingJobs[0].metrics.failures).toBe(3)
    expect(state.editingJobs[0].metrics.retries).toBe(4)
  } finally {
    await application.close()
  }
})
