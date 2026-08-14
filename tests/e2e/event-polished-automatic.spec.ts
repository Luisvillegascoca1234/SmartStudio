import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { createHash } from "node:crypto"
import { tmpdir } from "node:os"
import path from "node:path"
import { expect, test } from "@playwright/test"
import sharp from "sharp"

import { WorkflowStore } from "../../src/server/workflow-store.js"
import { historicalAdjustmentPresentation } from "../../src/client/editing-presentation.js"
import { TestApplication } from "./support/test-application.js"

async function begin(application: TestApplication) {
  await application.page.getByLabel("Nombre del evento").fill("Evento pulido")
  await application.page.getByRole("button", { name: "Crear evento" }).click()
}

async function completeSimulation(application: TestApplication): Promise<{ baseName: string; rawPath: string; jpegPath: string }> {
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
  return { baseName: capture.baseName, rawPath: capture.rawRelativePath!, jpegPath: capture.jpegRelativePath! }
}

test("aplica únicamente Evento pulido automático y permite rechazar conservando originales", async ({ browser }) => {
  const application = await TestApplication.start(browser, "smartstudio-polished-event-", { testFeatures: true })
  try {
    await begin(application)
    const { baseName, rawPath, jpegPath } = await completeSimulation(application)
    const card = application.page.getByTestId(`editing-job-${baseName}`)
    await expect(card.getByText("Lista para revisar", { exact: true })).toBeVisible({ timeout: 15_000 })
    await expect(card.getByText("Perfil: Evento pulido v1", { exact: true })).toBeVisible()
    await expect(application.page.getByText("Evento pulido · v1 · automático", { exact: true })).toBeVisible()

    for (const control of ["Exposición", "Temperatura", "Intensidad de color", "Suavizado de piel"]) {
      await expect(card.getByLabel(control, { exact: true })).toHaveCount(0)
    }
    await expect(card.getByRole("button", { name: "Aplicar ajustes" })).toHaveCount(0)
    await expect(card.getByRole("button", { name: "Reprocesar", exact: true })).toHaveCount(0)
    await expect(application.page.getByRole("button", { name: "Nueva versión del perfil" })).toHaveCount(0)
    await expect(card.getByLabel("Ampliación")).toBeVisible()
    await expect(card.getByRole("button", { name: "Vista dividida" })).toBeVisible()

    const beforeReject = await application.state()
    const job = beforeReject.editingJobs[0]
    expect(job.profile).toEqual({
      id: "polished-event",
      name: "Evento pulido",
      version: 1,
      defaults: { exposure: 0, temperature: 0, colorIntensity: 0, skinSmoothing: 2 },
    })
    expect(job.versions).toHaveLength(1)
    expect(job.processDiagnostics.some((diagnostic) => diagnostic.stage === "portrait-retouch" && diagnostic.termination === "completed")).toBe(true)
    const version = job.versions[0]
    const master = await application.readDataFile(version.masterRelativePath!)
    const masterMetadata = await sharp(master).metadata()
    expect(masterMetadata).toMatchObject({ format: "tiff", channels: 3, depth: "ushort", space: "rgb16" })
    expect(masterMetadata.icc?.length).toBeGreaterThan(0)
    expect(createHash("sha256").update(master).digest("hex")).toBe(version.masterSha256)
    expect(version.previewMasterSha256).toBe(version.masterSha256)
    expect(createHash("sha256").update(await application.readDataFile(version.previewRelativePath)).digest("hex")).toBe(version.previewSha256)
    expect(version.originalSha256).toBe(beforeReject.events[0].sessions[0].series[0].captures[0].rawSha256)
    expect(version.recipeVersion).toBe(1)
    expect(createHash("sha256").update(await application.readDataFile(version.recipeRelativePath!)).digest("hex")).toBe(version.recipeSha256)
    expect(version.developer).toBe("controlled")
    expect(version.iccProfile).toBe("sRGB")
    expect(await application.listDataFiles()).not.toEqual(expect.arrayContaining([
      expect.stringMatching(/\.styled\.jpg$/u),
      expect.stringMatching(/\.portrait\.jpg$/u),
      expect.stringMatching(/\.developed\.tif$/u),
      expect.stringMatching(/\.recipe\.tif$/u),
      expect.stringMatching(/\.tmp(?:\.|$)/u),
    ]))
    const [rawBefore, jpegBefore] = await Promise.all([
      application.readDataFile(rawPath),
      application.readDataFile(jpegPath),
    ])

    const blockedStatuses = await application.page.evaluate(async (id) => Promise.all([
      fetch(`/api/editing/${id}/adjustments`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }),
      fetch(`/api/editing/${id}/reset`, { method: "POST" }),
      fetch(`/api/editing/${id}/reprocess`, { method: "POST" }),
      fetch(`/api/editing/${id}/reprocess-current-profile`, { method: "POST" }),
      fetch("/api/events/profile/advance", { method: "POST" }),
    ]).then((responses) => responses.map((response) => response.status)), job.id)
    expect(blockedStatuses).toEqual([409, 409, 409, 409, 409])

    await card.getByRole("button", { name: "Rechazar y conservar original" }).click()
    await expect(card.getByText("Edición rechazada", { exact: true }).first()).toBeVisible()
    await expect(card.getByText("Rechazada", { exact: true })).toBeVisible()
    await expect(card.getByRole("button", { name: "Aprobar edición" })).toHaveCount(0)

    const rejected = (await application.state()).editingJobs[0]
    expect(rejected.status).toBe("rejected")
    expect(rejected.approvedVersionId).toBeNull()
    expect(rejected.versions[0].approvalStatus).toBe("rejected")
    expect(rejected.versions[0].deliveryStatus).toBe("not-requested")
    expect(rejected.attempts).toBe(1)
    expect(await application.readDataFile(rawPath)).toEqual(rawBefore)
    expect(await application.readDataFile(jpegPath)).toEqual(jpegBefore)
  } finally {
    await application.close()
  }
})

test("un reintento técnico conserva la receta automática fijada", async ({ browser }) => {
  const application = await TestApplication.start(browser, "smartstudio-polished-retry-", { testFeatures: true })
  try {
    await begin(application)
    await application.page.evaluate(async () => fetch("/api/test/editing/fail-next", { method: "POST" }))
    const { baseName } = await completeSimulation(application)
    const card = application.page.getByTestId(`editing-job-${baseName}`)
    await expect(card.getByText("Falló", { exact: true })).toBeVisible()
    const failed = (await application.state()).editingJobs[0]

    await card.getByRole("button", { name: "Reintentar edición" }).click()
    await expect(card.getByText("Lista para revisar", { exact: true })).toBeVisible()
    const recovered = (await application.state()).editingJobs[0]
    expect(recovered.profile).toEqual(failed.profile)
    expect(recovered.adjustments).toEqual(failed.adjustments)
    expect(recovered.matteConfiguration).toEqual(failed.matteConfiguration)
    expect(recovered.cleanPlateId).toBe(failed.cleanPlateId)
    expect(recovered.cleanPlateSha256).toBe(failed.cleanPlateSha256)
    expect(recovered.attempts).toBe(2)
    expect(recovered.versions).toHaveLength(1)
  } finally {
    await application.close()
  }
})

test("migra eventos a Evento pulido sin reinterpretar trabajos Natural históricos", async () => {
  const dataDirectory = await mkdtemp(path.join(tmpdir(), "smartstudio-polished-migration-"))
  const statePath = path.join(dataDirectory, "workflow-state.json")
  const naturalProfile = {
    id: "natural-event",
    name: "Natural de evento",
    version: 3,
    defaults: { exposure: 0, temperature: 0, colorIntensity: 0, skinSmoothing: 1 },
  }
  const historicalAdjustments = { exposure: 0.4, temperature: -0.2, colorIntensity: 0.3, skinSmoothing: 2 }
  try {
    await writeFile(statePath, JSON.stringify({
      version: 10,
      events: [{
        id: "event-legacy",
        name: "Evento histórico",
        location: null,
        notes: null,
        createdAt: new Date(0).toISOString(),
        closedAt: null,
        status: "active",
        sessions: [],
        editingProfile: naturalProfile,
      }],
      editingJobs: [{
        id: "job-legacy",
        eventId: "event-legacy",
        sessionId: "session-legacy",
        captureId: "capture-legacy",
        status: "review",
        createdAt: new Date(0).toISOString(),
        profile: naturalProfile,
        adjustments: historicalAdjustments,
        versions: [{
          id: "version-legacy",
          number: 1,
          createdAt: new Date(0).toISOString(),
          profile: naturalProfile,
          adjustments: historicalAdjustments,
          origin: "raw",
          previewRelativePath: "legacy-preview.jpg",
          approvalStatus: "review",
          approvedAt: null,
          revokedAt: null,
          fullRelativePath: null,
          deliveryStatus: "not-requested",
          deliveryError: null,
          width: null,
          height: null,
          backupStatus: "pending",
          backupError: null,
        }],
      }],
      activeEventId: "event-legacy",
      savedAt: null,
    }))

    const store = new WorkflowStore(dataDirectory)
    await store.initialize()
    const migrated = store.snapshot()
    expect(migrated.version).toBe(15)
    expect(migrated.events[0].editingProfile.id).toBe("polished-event")
    expect(migrated.events[0].editingProfile.name).toBe("Evento pulido")
    expect(migrated.editingJobs[0].profile).toEqual(naturalProfile)
    expect(migrated.editingJobs[0].adjustments).toEqual(historicalAdjustments)
    expect(migrated.editingJobs[0].versions[0].profile).toEqual(naturalProfile)
    expect(migrated.editingJobs[0].versions[0].adjustments).toEqual(historicalAdjustments)
    expect(historicalAdjustmentPresentation(migrated.editingJobs[0].versions[0].profile, migrated.editingJobs[0].versions[0].adjustments)).toBe("Parámetros históricos: exposición 0.4 · temperatura -0.2 · color 0.3 · piel 2")
    expect(JSON.parse(await readFile(statePath, "utf8")).version).toBe(15)
  } finally {
    await rm(dataDirectory, { recursive: true, force: true })
  }
})
