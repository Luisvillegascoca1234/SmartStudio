import { createReadStream } from "node:fs"
import { writeFile } from "node:fs/promises"
import path from "node:path"
import fastify, { type FastifyInstance } from "fastify"
import fastifyMultipart from "@fastify/multipart"
import fastifyStatic from "@fastify/static"

import {
  activeEvent,
  activeSeries,
  activeSession,
  captureById,
  sessionCaptures,
  sessionIsReadyForEditing,
  naturalEventProfile,
  type Capture,
  type EditingJob,
  type EditingVersion,
  type Event,
  type WorkflowState,
} from "../shared/workflow.js"
import { CaptureService } from "./capture-service.js"
import { EditingService } from "./editing-service.js"
import { OperationsService } from "./operations-service.js"
import { SonyFolderReceiver } from "./sony-folder-receiver.js"
import { WorkflowStore } from "./workflow-store.js"
import { sha256File } from "./file-hash.js"

export type ServerOptions = {
  dataDirectory: string
  staticDirectory?: string
  logger?: boolean
  testFeatures?: boolean
  editingProcessingDelayMilliseconds?: number
}

const requireText = (value: unknown, label: string): string => {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} es obligatorio.`)
  }
  return value.trim()
}

const optionalText = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : null

const createEditingJob = (event: Event, sessionId: string, capture: Capture, id = crypto.randomUUID()): EditingJob => ({
  id,
  eventId: event.id,
  sessionId,
  captureId: capture.id,
  status: "queued",
  createdAt: new Date().toISOString(),
  startedAt: null,
  finishedAt: null,
  previewReadyAt: null,
  approvedAt: null,
  previewRelativePath: null,
  error: null,
  attempts: 0,
  origin: null,
  rawIssue: null,
  jpegFallbackDecision: "not-needed",
  profile: structuredClone(event.editingProfile),
  adjustments: structuredClone(event.editingProfile.defaults),
  uncontrolledConditionsWarning: capture.quality?.warnings.some((warning) => warning === "exposure" || warning === "poor-framing")
    ? "La captura se aleja de las condiciones controladas; se aplicó una corrección conservadora."
    : null,
  lensCorrectionApplied: false,
  versions: [],
  currentVersionId: null,
  approvedVersionId: null,
  faceCount: 0,
  portraitWarnings: [],
  eyeEnhancementEnabled: true,
  teethWhiteningEnabled: true,
  metrics: { processingRoute: "cpu", previewMilliseconds: null, deliveryMilliseconds: null, failures: 0, retries: 0 },
  accelerationWarning: "Ruta CPU activa; OpenCV CUDA no está disponible en esta instalación.",
})

const backupCoverage = (version: EditingVersion, paths: Set<string>): { included: boolean; attempted: boolean } => {
  const requiredPaths = [version.previewRelativePath, ...(version.fullRelativePath ? [version.fullRelativePath] : [])]
  return {
    included: requiredPaths.every((relativePath) => paths.has(relativePath)),
    attempted: requiredPaths.some((relativePath) => paths.has(relativePath)),
  }
}

export async function createSmartStudioServer(options: ServerOptions): Promise<FastifyInstance> {
  const app = fastify({ logger: options.logger ?? false })
  const store = new WorkflowStore(options.dataDirectory)
  await store.initialize()
  const operations = new OperationsService(options.dataDirectory, options.testFeatures === true)
  await operations.initialize()
  store.onPersisted(() => operations.scheduleBackup())
  operations.onBackupResult((result) => {
    const paths = new Set(result.relativePaths)
    const snapshot = store.snapshot()
    const needsUpdate = snapshot.editingJobs.some((job) => job.versions.some((version) => {
      const { included, attempted } = backupCoverage(version, paths)
      const nextStatus = result.status === "verified" && included
        ? "verified"
        : result.status === "failed" && attempted && version.backupStatus !== "verified" ? "failed" : version.backupStatus
      return version.backupStatus !== nextStatus || (nextStatus === "failed" && version.backupError !== result.error)
    }))
    if (!needsUpdate) return
    void store.mutate((state) => {
      for (const job of state.editingJobs) for (const version of job.versions) {
        const { included, attempted } = backupCoverage(version, paths)
        if (result.status === "verified" && included) {
          version.backupStatus = "verified"
          version.backupError = null
        } else if (result.status === "failed" && attempted && version.backupStatus !== "verified") {
          version.backupStatus = "failed"
          version.backupError = result.error
        }
      }
    }).catch(() => undefined)
  })
  const captures = new CaptureService(store, options.dataDirectory)
  const editing = new EditingService(
    store,
    options.dataDirectory,
    options.editingProcessingDelayMilliseconds ?? (options.testFeatures ? 1_000 : 0),
    () => operations.assertCanFinishEditing(),
  )
  await editing.initialize()
  const enqueueEditingCapture = async (eventId: string, sessionId: string, captureId: string): Promise<WorkflowState> => {
    await operations.assertCanStartEditing()
    const snapshot = store.snapshot()
    const event = snapshot.events.find((item) => item.id === eventId)
    const session = event?.sessions.find((item) => item.id === sessionId)
    const capture = session?.series.flatMap((series) => series.captures).find((item) => item.id === captureId)
    if (!event || !session || !capture) throw new Error("La fotografía no existe en esta sesión fotográfica.")
    if (event.status !== "active") throw new Error("El evento está cerrado y no admite nuevos trabajos de edición.")
    const duplicate = snapshot.editingJobs.find((job) => job.captureId === captureId && job.profile.version === event.editingProfile.version)
    if (duplicate) return snapshot
    const job = createEditingJob(event, sessionId, capture)
    const result = await store.mutate((state) => {
      state.editingJobs.push(job)
    })
    editing.schedule(job.id)
    return result
  }
  const openEventForEditingJob = (jobId: string): Event => {
    const snapshot = store.snapshot()
    const job = snapshot.editingJobs.find((item) => item.id === jobId)
    const event = job && snapshot.events.find((item) => item.id === job.eventId)
    if (!job || !event) throw new Error("La edición no existe.")
    if (event.status !== "active") throw new Error("El evento está cerrado y no admite nuevas solicitudes de edición.")
    return event
  }
  const sonyReceiver = new SonyFolderReceiver(options.dataDirectory, (file) => captures.importSonyFile(file))
  await sonyReceiver.initialize()
  operations.setCaptureSourceProvider(() => sonyReceiver.snapshot())
  app.addHook("onClose", async () => {
    await sonyReceiver.close()
    await editing.waitForIdle()
    await operations.waitForBackup()
  })
  await app.register(fastifyMultipart, {
    limits: { fileSize: 200 * 1024 * 1024, files: 500, parts: 510 },
  })

  app.setErrorHandler((error, _request, reply) => {
    const message = error instanceof Error ? error.message : "Error local inesperado."
    const status = message.endsWith("obligatorio.") ? 400 : 409
    void reply.status(status).send({ error: message })
  })

  app.get("/api/state", async () => store.snapshot())
  app.get("/api/operations", async () => operations.snapshot())

  app.post<{ Body: { directory?: unknown } }>("/api/operations/backup", async (request) => {
    return operations.configureBackup(requireText(request.body?.directory, "La ruta del SSD"))
  })

  app.post<{ Body: { enabled?: unknown } }>("/api/operations/sound", async (request) => {
    if (typeof request.body?.enabled !== "boolean") throw new Error("El estado de las alertas sonoras no es válido.")
    return operations.setSoundAlerts(request.body.enabled)
  })

  app.post<{ Body: { directory?: unknown } }>("/api/sony-source", async (request) => {
    await sonyReceiver.configure(requireText(request.body?.directory, "La ruta de recepción Sony"))
    return operations.snapshot()
  })

  app.post<{ Body: Record<string, unknown> }>("/api/test/operations", async (request) => {
    return operations.setTestConditions(request.body)
  })

  app.post("/api/test/operations/wait-backup", async () => {
    if (!options.testFeatures) throw new Error("La espera controlada del respaldo solo está disponible en verificaciones.")
    return operations.waitForBackup()
  })

  app.post("/api/test/editing/fail-next", async () => {
    if (!options.testFeatures) throw new Error("El fallo controlado de edición solo está disponible en verificaciones.")
    editing.failNextForVerification()
    return { ready: true }
  })

  app.post("/api/test/editing/fail-next-delivery", async () => {
    if (!options.testFeatures) throw new Error("El fallo controlado de entrega solo está disponible en verificaciones.")
    editing.failNextDeliveryForVerification()
    return { ready: true }
  })

  app.post<{ Params: { id: string } }>("/api/test/editing/:id/interrupt", async (request) => {
    if (!options.testFeatures) throw new Error("La interrupción controlada solo está disponible en verificaciones.")
    return editing.simulateInterruptedState(request.params.id)
  })

  app.post<{ Params: { id: string } }>("/api/test/editing/:id/age-preview", async (request) => {
    if (!options.testFeatures) throw new Error("La demora controlada solo está disponible en verificaciones.")
    return store.mutate((state) => {
      const job = state.editingJobs.find((item) => item.id === request.params.id)
      if (!job) throw new Error("La edición no existe.")
      const agedAt = new Date(Date.now() - 31_000).toISOString()
      job.createdAt = agedAt
      job.startedAt = agedAt
    })
  })

  app.post<{
    Params: { id: string }
    Body: { condition?: "missing" | "corrupt" | "unsupported" | "valid" }
  }>("/api/test/captures/:id/raw-condition", async (request) => {
    if (!options.testFeatures) throw new Error("La condición RAW controlada solo está disponible en verificaciones.")
    const capture = captureById(store.snapshot(), request.params.id)
    if (!capture?.rawRelativePath) throw new Error("La captura no tiene un RAW controlable.")
    if (request.body.condition === "missing") {
      return store.mutate((state) => {
        const current = captureById(state, request.params.id)!
        current.rawRelativePath = null
        current.rawSha256 = null
        current.status = "raw-pending"
      })
    }
    const contents = request.body.condition === "unsupported"
      ? Buffer.from("SMARTSTUDIO_UNSUPPORTED_RAW\0fixture", "ascii")
      : request.body.condition === "valid"
        ? Buffer.from("SMARTSTUDIO_SIMULATED_RAW\0fixture-corregido", "ascii")
        : Buffer.from("RAW_CORRUPTO_CONTROLADO\0fixture", "ascii")
    const rawPath = path.join(options.dataDirectory, capture.rawRelativePath)
    await writeFile(rawPath, contents)
    const sha256 = await sha256File(rawPath)
    return store.mutate((state) => {
      captureById(state, request.params.id)!.rawSha256 = sha256
    })
  })

  app.post<{
    Body: { name?: unknown; location?: unknown; notes?: unknown }
  }>("/api/events", async (request) => {
    const name = requireText(request.body?.name, "El nombre del evento")
    const current = store.snapshot()
    if (activeEvent(current)) throw new Error("Cierra el evento activo antes de crear otro.")
    return store.mutate((state) => {
      const id = crypto.randomUUID()
      state.events.push({
        id,
        name,
        location: optionalText(request.body.location),
        notes: optionalText(request.body.notes),
        createdAt: new Date().toISOString(),
        closedAt: null,
        status: "active",
        sessions: [],
        editingProfile: naturalEventProfile(),
      })
      state.activeEventId = id
    })
  })

  app.post<{ Params: { id: string } }>("/api/events/:id/reopen", async (request) => {
    const current = store.snapshot()
    if (activeEvent(current)) throw new Error("Ya existe un evento operativo activo.")
    if (!current.events.some((event) => event.id === request.params.id)) {
      throw new Error("El evento no existe.")
    }
    return store.mutate((state) => {
      const event = state.events.find((item) => item.id === request.params.id)!
      event.status = "active"
      event.closedAt = null
      state.activeEventId = event.id
    })
  })

  app.post("/api/events/close", async () => {
    const current = store.snapshot()
    const event = activeEvent(current)
    if (!event) throw new Error("No existe un evento activo.")
    if (activeSession(current)) throw new Error("Finaliza o cancela la sesión fotográfica activa antes de cerrar el evento.")
    return store.mutate((state) => {
      const currentEvent = activeEvent(state)!
      currentEvent.status = "closed"
      currentEvent.closedAt = new Date().toISOString()
      state.activeEventId = null
    })
  })

  app.post<{ Body: { label?: unknown } }>("/api/sessions", async (request) => {
    await operations.assertCanStartSession()
    const current = store.snapshot()
    const event = activeEvent(current)
    if (!event) throw new Error("Primero crea o reabre un evento.")
    if (activeSession(current)) throw new Error("Ya existe una sesión fotográfica activa.")
    return store.mutate((state) => {
      const currentEvent = activeEvent(state)!
      currentEvent.sessions.push({
        id: crypto.randomUUID(),
        number: currentEvent.sessions.length + 1,
        label: optionalText(request.body?.label),
        startedAt: new Date().toISOString(),
        completedAt: null,
        cancelledAt: null,
        status: "active",
        series: [],
      })
    })
  })

  app.post("/api/sessions/cancel", async () => {
    if (!activeSession(store.snapshot())) throw new Error("No existe una sesión fotográfica activa.")
    return store.mutate((state) => {
      const session = activeSession(state)!
      session.status = "cancelled"
      session.cancelledAt = new Date().toISOString()
    })
  })

  app.post<{ Params: { id: string } }>("/api/sessions/:id/restore", async (request) => {
    const current = store.snapshot()
    const event = activeEvent(current)
    if (!event) throw new Error("No existe un evento activo.")
    if (activeSession(current)) throw new Error("Ya existe una sesión fotográfica activa.")
    const session = event.sessions.find((item) => item.id === request.params.id)
    if (!session || session.status !== "cancelled") throw new Error("La sesión fotográfica cancelada no existe.")
    return store.mutate((state) => {
      const restored = activeEvent(state)!.sessions.find((item) => item.id === request.params.id)!
      restored.status = "active"
      restored.cancelledAt = null
    })
  })

  app.post("/api/sessions/complete", async () => {
    await operations.assertCanStartEditing()
    const session = activeSession(store.snapshot())
    if (!session) throw new Error("No existe una sesión fotográfica activa.")
    if (!sessionIsReadyForEditing(session)) {
      throw new Error("La sesión fotográfica necesita entre una y tres selecciones y exactamente una principal.")
    }
    const principal = sessionCaptures(session).find((capture) => capture.principal)!
    let jobId = ""
    const result = await store.mutate((state) => {
      const event = activeEvent(state)!
      const currentSession = activeSession(state)!
      currentSession.status = "completed"
      currentSession.completedAt = new Date().toISOString()
      const job = createEditingJob(event, currentSession.id, principal)
      jobId = job.id
      state.editingJobs.push(job)
    })
    editing.schedule(jobId)
    return result
  })

  app.post<{ Params: { id: string }; Body?: { versionId?: string } }>("/api/editing/:id/approve", async (request) => {
    return editing.approve(request.params.id, request.body?.versionId)
  })

  app.post<{ Params: { id: string } }>("/api/editing/:id/cancel", async (request) => {
    return editing.cancel(request.params.id)
  })

  app.post<{ Params: { id: string } }>("/api/editing/:id/retry", async (request) => {
    return editing.retry(request.params.id)
  })

  app.post<{ Params: { id: string } }>("/api/editing/:id/authorize-jpeg", async (request) => {
    return editing.authorizeJpegFallback(request.params.id)
  })

  app.post<{ Params: { id: string } }>("/api/editing/:id/reject-jpeg", async (request) => {
    return editing.rejectJpegFallback(request.params.id)
  })

  app.post<{ Params: { id: string } }>("/api/editing/:id/retry-raw", async (request) => {
    return editing.retryRaw(request.params.id)
  })

  app.post<{ Params: { id: string }; Body: Record<string, unknown> }>("/api/editing/:id/adjustments", async (request) => {
    await operations.assertCanStartEditing()
    openEventForEditingJob(request.params.id)
    return editing.updateAdjustments(request.params.id, request.body)
  })

  app.post<{ Params: { id: string } }>("/api/editing/:id/reset", async (request) => {
    await operations.assertCanStartEditing()
    openEventForEditingJob(request.params.id)
    return editing.resetAdjustments(request.params.id)
  })

  app.post<{ Params: { id: string } }>("/api/editing/:id/reprocess", async (request) => {
    await operations.assertCanStartEditing()
    openEventForEditingJob(request.params.id)
    return editing.reprocess(request.params.id)
  })
  app.post<{ Params: { id: string } }>("/api/editing/:id/reprocess-current-profile", async (request) => {
    await operations.assertCanStartEditing()
    const event = openEventForEditingJob(request.params.id)
    return editing.reprocessWithProfile(request.params.id, event.editingProfile)
  })
  app.post<{ Params: { id: string } }>("/api/editing/:id/revoke", async (request) => editing.revokeApproval(request.params.id))
  app.post<{ Params: { id: string } }>("/api/editing/:id/retry-delivery", async (request) => editing.retryDelivery(request.params.id))

  app.post<{ Params: { id: string; captureId: string } }>("/api/editing/:id/alternatives/:captureId/process", async (request) => {
    const job = store.snapshot().editingJobs.find((item) => item.id === request.params.id)
    if (!job) throw new Error("La edición no existe.")
    return enqueueEditingCapture(job.eventId, job.sessionId, request.params.captureId)
  })

  app.post<{ Params: { id: string; captureId: string } }>("/api/editing/:id/principal/:captureId", async (request) => {
    openEventForEditingJob(request.params.id)
    const snapshot = store.snapshot()
    const job = snapshot.editingJobs.find((item) => item.id === request.params.id)
    const event = job && snapshot.events.find((item) => item.id === job.eventId)
    const session = event?.sessions.find((item) => item.id === job?.sessionId)
    const target = session?.series.flatMap((series) => series.captures).find((capture) => capture.id === request.params.captureId)
    if (!job || !session || !target?.selected) throw new Error("La alternativa debe estar seleccionada para convertirse en principal.")
    await store.mutate((state) => {
      const currentEvent = state.events.find((item) => item.id === job.eventId)!
      const currentSession = currentEvent.sessions.find((item) => item.id === job.sessionId)!
      for (const capture of currentSession.series.flatMap((series) => series.captures)) capture.principal = capture.id === target.id
      for (const editingJob of state.editingJobs.filter((item) => item.sessionId === job.sessionId)) {
        editingJob.approvedVersionId = null
        editingJob.approvedAt = null
        if (editingJob.status === "approved") editingJob.status = "review"
        for (const version of editingJob.versions) if (version.approvalStatus === "approved") version.approvalStatus = "superseded"
      }
    })
    return enqueueEditingCapture(job.eventId, job.sessionId, target.id)
  })

  app.post("/api/events/profile/advance", async () => {
    const event = activeEvent(store.snapshot())
    if (!event) throw new Error("No existe un evento activo.")
    return store.mutate((state) => {
      const current = activeEvent(state)!
      current.editingProfile = naturalEventProfile(current.editingProfile.version + 1)
    })
  })

  app.post("/api/series", async () => {
    const current = store.snapshot()
    const session = activeSession(current)
    if (!session) throw new Error("Primero inicia o restaura una sesión fotográfica.")
    if (session.series.at(-1)?.status === "capturing") throw new Error("Ya existe una serie abierta.")
    return store.mutate((state) => {
      const currentSession = activeSession(state)!
      currentSession.series.push({
        id: crypto.randomUUID(),
        number: currentSession.series.length + 1,
        startedAt: new Date().toISOString(),
        closedAt: null,
        status: "capturing",
        captures: [],
        warnings: [],
      })
    })
  })

  app.post("/api/simulated-captures", async () => captures.simulatePair())

  app.post("/api/simulated-captures/quality-fixtures", async () => {
    if (!options.testFeatures) throw new Error("Las fotografías controladas solo están disponibles durante verificaciones.")
    return captures.simulateQualityFixtures()
  })

  app.post<{ Params: { order: "jpeg-first" | "raw-first" } }>("/api/simulated-captures/:order", async (request) => {
    if (!new Set(["jpeg-first", "raw-first"]).has(request.params.order)) {
      throw new Error("Orden de simulación no reconocido.")
    }
    return captures.simulateFirst(request.params.order)
  })

  app.post<{ Params: { id: string } }>("/api/captures/:id/simulate-missing", async (request) => {
    return captures.completeSimulatedCapture(request.params.id)
  })

  app.post("/api/imports", async (request) => {
    const { files } = await request.saveRequestFiles()
    return captures.importFiles(files)
  })

  app.post<{ Params: { id: string } }>("/api/captures/:id/exclude", async (request) => {
    return captures.exclude(request.params.id)
  })

  app.post<{ Params: { id: string } }>("/api/captures/:id/restore", async (request) => {
    return captures.restore(request.params.id)
  })

  app.post<{ Params: { id: string } }>("/api/captures/:id/authorize-jpeg", async (request) => {
    return captures.authorizeEmergencyJpeg(request.params.id)
  })

  app.post("/api/series/close", async () => {
    const series = activeSeries(store.snapshot())
    if (!series || series.status !== "capturing") throw new Error("No existe una serie abierta.")
    if (series.captures.length === 0) throw new Error("La serie necesita al menos una captura.")
    return store.mutate((state) => {
      const currentSeries = activeSeries(state)!
      currentSeries.status = "review"
      currentSeries.closedAt = new Date().toISOString()
    })
  })

  app.post<{ Params: { id: string } }>("/api/captures/:id/select", async (request) => {
    const series = activeSeries(store.snapshot())
    if (!series || series.status === "capturing") throw new Error("Cierra la serie antes de seleccionar.")
    const session = activeSession(store.snapshot())!
    const selectedCapture = sessionCaptures(session).find((capture) => capture.id === request.params.id)
    if (!selectedCapture) {
      throw new Error("La captura no existe en la sesión fotográfica activa.")
    }
    if (selectedCapture.excluded) throw new Error("La captura está excluida de la revisión.")
    if (selectedCapture.status !== "complete" && !selectedCapture.emergencyJpegAuthorized) {
      throw new Error("La captura está incompleta.")
    }
    if (!selectedCapture.selected && sessionCaptures(session).filter((capture) => capture.selected).length >= 3) {
      throw new Error("Solo puedes seleccionar hasta tres fotografías.")
    }
    return store.mutate((state) => {
      const currentSession = activeSession(state)!
      const capture = sessionCaptures(currentSession).find((item) => item.id === request.params.id)!
      capture.selected = true
    })
  })

  app.post<{ Params: { id: string } }>("/api/captures/:id/deselect", async (request) => {
    const session = activeSession(store.snapshot())
    const capture = session && sessionCaptures(session).find((item) => item.id === request.params.id)
    if (!capture?.selected) throw new Error("La captura seleccionada no existe.")
    return store.mutate((state) => {
      const currentSession = activeSession(state)!
      const item = sessionCaptures(currentSession).find((candidate) => candidate.id === request.params.id)!
      item.selected = false
      item.principal = false
      const currentSeries = activeSeries(state)
      if (currentSeries?.status === "selected") currentSeries.status = "review"
    })
  })

  app.post<{ Params: { id: string } }>("/api/captures/:id/principal", async (request) => {
    const session = activeSession(store.snapshot())
    const capture = session && sessionCaptures(session).find((item) => item.id === request.params.id)
    if (!session || !capture?.selected) throw new Error("Selecciona la captura antes de marcarla principal.")
    return store.mutate((state) => {
      const currentSession = activeSession(state)!
      const currentSeries = activeSeries(state)!
      for (const item of sessionCaptures(currentSession)) item.principal = item.id === request.params.id
      currentSeries.status = "selected"
    })
  })

  app.get<{ Params: { id: string } }>("/captures/:id/preview", async (request, reply) => {
    const capture = captureById(store.snapshot(), request.params.id)
    if (!capture?.jpegRelativePath) return reply.status(404).send({ error: "La vista previa JPEG está pendiente." })
    reply.type("image/jpeg")
    return reply.send(createReadStream(path.join(options.dataDirectory, capture.jpegRelativePath)))
  })

  app.get<{ Params: { id: string } }>("/editing/:id/preview", async (request, reply) => {
    const job = store.snapshot().editingJobs.find((item) => item.id === request.params.id)
    if (!job?.previewRelativePath) return reply.status(404).send({ error: "La edición todavía no tiene vista previa." })
    reply.type("image/jpeg")
    return reply.send(createReadStream(path.join(options.dataDirectory, job.previewRelativePath)))
  })

  if (options.staticDirectory) {
    await app.register(fastifyStatic, { root: options.staticDirectory, wildcard: false })
  }

  return app
}
