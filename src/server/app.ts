import { createReadStream } from "node:fs"
import path from "node:path"
import fastify, { type FastifyInstance } from "fastify"
import fastifyMultipart from "@fastify/multipart"
import fastifyStatic from "@fastify/static"

import {
  activeEvent,
  activeSeries,
  activeSession,
  sessionCaptures,
  sessionIsReadyForEditing,
  type Capture,
  type WorkflowState,
} from "../shared/workflow.js"
import { CaptureService } from "./capture-service.js"
import { OperationsService } from "./operations-service.js"
import { SonyFolderReceiver } from "./sony-folder-receiver.js"
import { WorkflowStore } from "./workflow-store.js"

export type ServerOptions = {
  dataDirectory: string
  staticDirectory?: string
  logger?: boolean
  testFeatures?: boolean
}

const requireText = (value: unknown, label: string): string => {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} es obligatorio.`)
  }
  return value.trim()
}

const optionalText = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : null

const findCapture = (state: WorkflowState, id: string): Capture | null => {
  for (const event of state.events) {
    for (const session of event.sessions) {
      for (const series of session.series) {
        const capture = series.captures.find((item) => item.id === id)
        if (capture) return capture
      }
    }
  }
  return null
}

export async function createSmartStudioServer(options: ServerOptions): Promise<FastifyInstance> {
  const app = fastify({ logger: options.logger ?? false })
  const store = new WorkflowStore(options.dataDirectory)
  await store.initialize()
  const operations = new OperationsService(options.dataDirectory, options.testFeatures === true)
  await operations.initialize()
  store.onPersisted(() => operations.scheduleBackup())
  const captures = new CaptureService(store, options.dataDirectory)
  const sonyReceiver = new SonyFolderReceiver(options.dataDirectory, (file) => captures.importSonyFile(file))
  await sonyReceiver.initialize()
  operations.setCaptureSourceProvider(() => sonyReceiver.snapshot())
  app.addHook("onClose", async () => {
    await sonyReceiver.close()
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
    const session = activeSession(store.snapshot())
    if (!session) throw new Error("No existe una sesión fotográfica activa.")
    if (!sessionIsReadyForEditing(session)) {
      throw new Error("La sesión fotográfica necesita entre una y tres selecciones y exactamente una principal.")
    }
    return store.mutate((state) => {
      const currentSession = activeSession(state)!
      currentSession.status = "completed"
      currentSession.completedAt = new Date().toISOString()
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
    const capture = findCapture(store.snapshot(), request.params.id)
    if (!capture?.jpegRelativePath) return reply.status(404).send({ error: "La vista previa JPEG está pendiente." })
    reply.type("image/jpeg")
    return reply.send(createReadStream(path.join(options.dataDirectory, capture.jpegRelativePath)))
  })

  if (options.staticDirectory) {
    await app.register(fastifyStatic, { root: options.staticDirectory, wildcard: false })
  }

  return app
}
