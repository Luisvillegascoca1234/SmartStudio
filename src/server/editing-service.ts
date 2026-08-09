import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import { initializeCanvas, readPsd, writePsdBuffer } from "ag-psd"
import sharp from "sharp"

import { captureById, type AdobeResourceSnapshot, type EditingJob, type EditingProfile, type ProcessingRoute, type WorkflowState } from "../shared/workflow.js"
import type { EditingEngine } from "./editing-engine.js"
import type { PortraitResult } from "./portrait-retoucher.js"
import { WorkflowStore } from "./workflow-store.js"
import { RawDevelopmentError } from "./raw-developer.js"

initializeCanvas(
  () => { throw new Error("La lectura PSD local no requiere canvas.") },
  (width, height) => ({ width, height, data: new Uint8ClampedArray(width * height * 4), colorSpace: "srgb" }) as ImageData,
)

const findJob = (state: WorkflowState, id: string): EditingJob | null =>
  state.editingJobs.find((job) => job.id === id) ?? null

type EditingOperation =
  | { kind: "preview"; jobId: string }
  | { kind: "delivery"; jobId: string; versionId: string }

class EditingTimeoutError extends Error {}
class EditingCancelledError extends Error {}

type ActiveRender = {
  controller: AbortController
  interrupt: (error: Error) => void
}

export class EditingService {
  private readonly queue: EditingOperation[] = []
  private readonly cancellationRequests = new Set<string>()
  private currentOperation: EditingOperation | null = null
  private drainPromise: Promise<void> | null = null
  private controlledFailurePending = false
  private controlledDeliveryFailurePending = false
  private readonly engines: Map<EditingJob["engine"], EditingEngine>
  private readonly activeRenders = new Map<string, ActiveRender>()
  private readonly activeAttemptTokens = new Map<string, string>()
  private manualCorrectionJobId: string | null = null

  constructor(
    private readonly store: WorkflowStore,
    private readonly dataDirectory: string,
    private readonly controlledProcessingDelayMilliseconds = 0,
    private readonly assertCanFinish: () => Promise<void> = async () => undefined,
    engines: EditingEngine[],
    private readonly processingTimeoutMilliseconds = 120_000,
    private readonly delayWarningMilliseconds = 30_000,
  ) {
    this.engines = new Map(engines.map((engine) => [engine.id, engine]))
  }

  async initialize(): Promise<void> {
    const interrupted = this.store.snapshot().editingJobs.filter((job) => job.status === "processing")
    for (const job of interrupted) await this.removePartialResult(job)
    if (interrupted.length > 0) {
      await this.store.mutate((state) => {
        for (const job of state.editingJobs) {
          if (job.status !== "processing") continue
          job.status = "interrupted"
          job.finishedAt = new Date().toISOString()
          job.error = "La aplicación se cerró durante el procesamiento. Reintenta la edición."
          job.previewRelativePath = null
          job.previewReadyAt = null
        }
      })
    }
    const manualCorrections = this.store.snapshot().editingJobs.filter((job) => job.manualCorrection?.status === "prepared")
    if (manualCorrections.length > 0) {
      await this.store.mutate((state) => {
        for (const job of state.editingJobs) {
          if (job.manualCorrection?.status !== "prepared") continue
          job.manualCorrection.status = "interrupted"
          job.manualCorrection.finishedAt = new Date().toISOString()
        }
      })
    }
    for (const job of this.store.snapshot().editingJobs) {
      if (job.status === "queued") this.schedule(job.id)
      for (const version of job.versions) {
        if (version.deliveryStatus === "generating") this.scheduleDelivery(job.id, version.id)
      }
    }
  }

  schedule(jobId: string): void {
    if (
      (this.currentOperation?.kind === "preview" && this.currentOperation.jobId === jobId) ||
      this.queue.some((operation) => operation.kind === "preview" && operation.jobId === jobId)
    ) return
    const job = findJob(this.store.snapshot(), jobId)
    if (!job || job.status !== "queued") return
    this.queue.push({ kind: "preview", jobId })
    this.startDrain()
  }

  private scheduleDelivery(jobId: string, versionId: string): void {
    if (
      (this.currentOperation?.kind === "delivery" && this.currentOperation.versionId === versionId) ||
      this.queue.some((operation) => operation.kind === "delivery" && operation.versionId === versionId)
    ) return
    this.queue.push({ kind: "delivery", jobId, versionId })
    this.startDrain()
  }

  async cancel(jobId: string): Promise<WorkflowState> {
    const job = findJob(this.store.snapshot(), jobId)
    if (!job || (job.status !== "queued" && job.status !== "processing")) {
      throw new Error("Solo puedes cancelar una edición en cola o en proceso.")
    }
    this.cancellationRequests.add(jobId)
    const activeRender = this.activeRenders.get(jobId)
    if (activeRender) {
      activeRender.controller.abort()
      activeRender.interrupt(new EditingCancelledError("La edición fue cancelada por el operador."))
    }
    const queuedIndex = this.queue.findIndex((operation) => operation.kind === "preview" && operation.jobId === jobId)
    if (queuedIndex >= 0) this.queue.splice(queuedIndex, 1)
    await this.removePartialResult(job)
    return this.store.mutate((state) => {
      const current = findJob(state, jobId)!
      current.status = "cancelled"
      current.finishedAt = new Date().toISOString()
      current.previewRelativePath = null
      current.previewReadyAt = null
      current.error = null
      current.metrics.lastAttemptMilliseconds = current.startedAt ? Date.now() - new Date(current.startedAt).getTime() : null
    })
  }

  async retry(jobId: string): Promise<WorkflowState> {
    const job = findJob(this.store.snapshot(), jobId)
    if (!job || !new Set(["failed", "interrupted", "cancelled"]).has(job.status)) {
      throw new Error("Solo puedes reintentar una edición fallida, interrumpida o cancelada.")
    }
    while (this.currentOperation?.kind === "preview" && this.currentOperation.jobId === jobId) await this.delay(10)
    await this.removePartialResult(job)
    const result = await this.store.mutate((state) => {
      const current = findJob(state, jobId)!
      current.status = "queued"
      current.startedAt = null
      current.finishedAt = null
      current.previewReadyAt = null
      current.approvedAt = null
      current.previewRelativePath = null
      current.error = null
    })
    this.cancellationRequests.delete(jobId)
    this.schedule(jobId)
    return result
  }

  async authorizeJpegFallback(jobId: string): Promise<WorkflowState> {
    const snapshot = this.store.snapshot()
    const job = findJob(snapshot, jobId)
    const capture = job ? captureById(snapshot, job.captureId) : null
    if (!job || !capture?.jpegRelativePath || !new Set(["awaiting-jpeg-authorization", "jpeg-rejected"]).has(job.status)) {
      throw new Error("El procesamiento desde JPEG no está disponible para este trabajo.")
    }
    const result = await this.store.mutate((state) => {
      const current = findJob(state, jobId)!
      current.status = "queued"
      current.jpegFallbackDecision = "authorized"
      current.origin = "jpeg"
      current.error = null
      current.finishedAt = null
    })
    this.schedule(jobId)
    return result
  }

  async rejectJpegFallback(jobId: string): Promise<WorkflowState> {
    const job = findJob(this.store.snapshot(), jobId)
    if (!job || job.status !== "awaiting-jpeg-authorization") {
      throw new Error("No existe una autorización JPEG pendiente para este trabajo.")
    }
    await this.removePartialResult(job)
    return this.store.mutate((state) => {
      const current = findJob(state, jobId)!
      current.status = "jpeg-rejected"
      current.jpegFallbackDecision = "rejected"
      current.origin = null
      current.previewRelativePath = null
      current.previewReadyAt = null
      current.finishedAt = new Date().toISOString()
      current.error = "Se rechazó procesar desde JPEG. El trabajo y los originales se conservaron sin crear un resultado."
    })
  }

  async retryRaw(jobId: string): Promise<WorkflowState> {
    const job = findJob(this.store.snapshot(), jobId)
    if (!job || !new Set(["awaiting-jpeg-authorization", "jpeg-rejected"]).has(job.status)) {
      throw new Error("No existe un RAW pendiente de reintento para este trabajo.")
    }
    await this.removePartialResult(job)
    const result = await this.store.mutate((state) => {
      const current = findJob(state, jobId)!
      current.status = "queued"
      current.startedAt = null
      current.finishedAt = null
      current.rawIssue = null
      current.jpegFallbackDecision = "not-needed"
      current.origin = null
      current.error = null
    })
    this.schedule(jobId)
    return result
  }

  async updateAdjustments(jobId: string, value: Record<string, unknown>): Promise<WorkflowState> {
    const job = findJob(this.store.snapshot(), jobId)
    if (!job || !new Set(["review", "approved"]).has(job.status)) {
      throw new Error("La edición debe estar lista para ajustar.")
    }
    const limits = {
      exposure: [-1, 1],
      temperature: [-1, 1],
      colorIntensity: [-1, 1],
      skinSmoothing: [0, 2],
    } as const
    const adjustments = structuredClone(job.adjustments)
    for (const [key, [minimum, maximum]] of Object.entries(limits)) {
      if (!(key in value)) continue
      const amount = value[key]
      if (typeof amount !== "number" || !Number.isFinite(amount) || amount < minimum || amount > maximum) {
        throw new Error(`El ajuste ${key} está fuera del límite seguro.`)
      }
      adjustments[key as keyof typeof adjustments] = amount
    }
    await this.removePartialResult(job)
    const result = await this.store.mutate((state) => {
      const current = findJob(state, jobId)!
      current.adjustments = adjustments
      current.status = "queued"
      current.approvedAt = null
      current.previewRelativePath = null
      current.previewReadyAt = null
      current.finishedAt = null
      current.error = null
    })
    this.schedule(jobId)
    return result
  }

  async resetAdjustments(jobId: string): Promise<WorkflowState> {
    const job = findJob(this.store.snapshot(), jobId)
    if (!job) throw new Error("La edición no existe.")
    return this.updateAdjustments(jobId, job.profile.defaults)
  }

  failNextForVerification(): void {
    this.controlledFailurePending = true
  }

  failNextDeliveryForVerification(): void {
    this.controlledDeliveryFailurePending = true
  }

  async reprocess(jobId: string): Promise<WorkflowState> {
    return this.queueReprocess(jobId)
  }

  async reprocessWithProfile(jobId: string, profile: EditingProfile, adobeResources?: AdobeResourceSnapshot): Promise<WorkflowState> {
    return this.queueReprocess(jobId, profile, adobeResources)
  }

  async prepareManualCorrection(jobId: string, versionId: string): Promise<WorkflowState> {
    const snapshot = this.store.snapshot()
    const job = findJob(snapshot, jobId)
    const version = job?.versions.find((item) => item.id === versionId)
    if (!job || !version || job.engine !== "adobe" || !new Set(["review", "approved"]).has(job.status)) {
      throw new Error("La versión Adobe no está lista para una corrección manual.")
    }
    if (snapshot.editingJobs.some((item) => item.manualCorrection?.status === "prepared")) {
      throw new Error("Ya existe una corrección manual de Photoshop en curso.")
    }
    const sourceRelativePath = version.fullRelativePath ?? version.previewRelativePath
    const sourcePath = path.join(this.dataDirectory, sourceRelativePath)
    const directory = path.join("manual-corrections", job.id, version.id)
    const psdRelativePath = path.join(directory, "SmartStudio-correccion.psd")
    const psdPath = path.join(this.dataDirectory, psdRelativePath)
    await mkdir(path.dirname(psdPath), { recursive: true })
    const raw = await sharp(sourcePath).rotate().ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    const pixels = {
      width: raw.info.width,
      height: raw.info.height,
      data: new Uint8ClampedArray(raw.data.buffer, raw.data.byteOffset, raw.data.byteLength),
    }
    const psd = writePsdBuffer({
      width: raw.info.width,
      height: raw.info.height,
      imageData: pixels,
      children: [{ name: `Origen ${version.automation === "backdrop" ? "SmartStudio-Fondo" : "SmartStudio-Natural"} v${version.number}`, imageData: pixels }],
    }, { generateThumbnail: false })
    await writeFile(psdPath, psd)
    this.manualCorrectionJobId = jobId
    return this.store.mutate((state) => {
      const current = findJob(state, jobId)!
      current.manualCorrection = {
        status: "prepared",
        sourceVersionId: versionId,
        psdRelativePath,
        startedAt: new Date().toISOString(),
        finishedAt: null,
        backupStatus: "pending",
        backupError: null,
      }
    })
  }

  async finishManualCorrection(jobId: string): Promise<WorkflowState> {
    const snapshot = this.store.snapshot()
    const job = findJob(snapshot, jobId)
    const correction = job?.manualCorrection
    const source = job?.versions.find((version) => version.id === correction?.sourceVersionId)
    if (!job || !correction || correction.status !== "prepared" || !source) throw new Error("No existe una corrección manual preparada.")
    const psdPath = path.join(this.dataDirectory, correction.psdRelativePath)
    const psd = readPsd(await readFile(psdPath), { useImageData: true, skipThumbnail: true })
    if (!psd.imageData?.data || psd.width < 1 || psd.height < 1) throw new Error("El PSD corregido no contiene una composición legible.")
    const versionNumber = job.versions.length + 1
    const fullRelativePath = path.join("events", job.eventId, "sessions", job.sessionId, "edits", `${job.id}-v${versionNumber}-manual-full.jpg`)
    const previewRelativePath = this.previewRelativePath(job, versionNumber)
    const fullPath = path.join(this.dataDirectory, fullRelativePath)
    const previewPath = path.join(this.dataDirectory, previewRelativePath)
    await mkdir(path.dirname(fullPath), { recursive: true })
    await sharp(Buffer.from(psd.imageData.data.buffer, psd.imageData.data.byteOffset, psd.imageData.data.byteLength), {
      raw: { width: psd.width, height: psd.height, channels: 4 },
    }).toColourspace("srgb").jpeg({ quality: 94, chromaSubsampling: "4:4:4" }).toFile(fullPath)
    await sharp(fullPath).resize(960, 960, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 86 }).toFile(previewPath)
    const result = await this.store.mutate((state) => {
      const current = findJob(state, jobId)!
      const createdAt = new Date().toISOString()
      const version = {
        id: crypto.randomUUID(),
        number: versionNumber,
        createdAt,
        profile: structuredClone(source.profile),
        adobeResources: structuredClone(source.adobeResources),
        adjustments: structuredClone(source.adjustments),
        engine: source.engine,
        automation: source.automation,
        origin: source.origin,
        previewRelativePath,
        approvalStatus: "review" as const,
        approvedAt: null,
        revokedAt: null,
        fullRelativePath,
        deliveryStatus: "not-requested" as const,
        deliveryError: null,
        width: psd.width,
        height: psd.height,
        backupStatus: "pending" as const,
        backupError: null,
      }
      current.versions.push(version)
      current.currentVersionId = version.id
      current.previewRelativePath = previewRelativePath
      current.previewReadyAt = createdAt
      current.status = "review"
      current.automation = source.automation
      current.profile = structuredClone(source.profile)
      current.adobeResources = structuredClone(source.adobeResources)
      current.adjustments = structuredClone(source.adjustments)
      current.origin = source.origin
      current.manualCorrection = { ...correction, status: "saved", finishedAt: createdAt }
    })
    this.manualCorrectionJobId = null
    if (this.queue.length > 0) this.startDrain()
    return result
  }

  async cancelManualCorrection(jobId: string): Promise<WorkflowState> {
    const job = findJob(this.store.snapshot(), jobId)
    if (!job?.manualCorrection || job.manualCorrection.status !== "prepared") throw new Error("No existe una corrección manual activa.")
    const result = await this.store.mutate((state) => {
      const current = findJob(state, jobId)!
      current.manualCorrection = { ...current.manualCorrection!, status: "cancelled", finishedAt: new Date().toISOString() }
    })
    this.manualCorrectionJobId = null
    if (this.queue.length > 0) this.startDrain()
    return result
  }

  async requestBackdrop(jobId: string): Promise<WorkflowState> {
    const job = findJob(this.store.snapshot(), jobId)
    if (!job || job.engine !== "adobe" || !new Set(["review", "approved"]).has(job.status) || !job.versions.some((version) => version.automation === "natural")) {
      throw new Error("SmartStudio-Fondo requiere una versión Natural Adobe lista para revisar.")
    }
    const result = await this.store.mutate((state) => {
      const current = findJob(state, jobId)!
      current.status = "queued"
      current.automation = "backdrop"
      current.adobeResources = {
        ...structuredClone(current.adobeResources),
        bundle: "SmartStudio Fondo Adobe",
        action: { ...structuredClone(current.adobeResources.action), name: "SmartStudio-Fondo" },
      }
      current.previewRelativePath = null
      current.previewReadyAt = null
      current.finishedAt = null
      current.error = null
    })
    this.schedule(jobId)
    return result
  }

  async rejectVersion(jobId: string, versionId: string): Promise<WorkflowState> {
    const job = findJob(this.store.snapshot(), jobId)
    const rejected = job?.versions.find((version) => version.id === versionId)
    const fallback = job?.versions.toReversed().find((version) => version.id !== versionId && version.approvalStatus !== "rejected")
    if (!job || !rejected || rejected.approvalStatus !== "review" || !fallback) throw new Error("La versión no puede rechazarse.")
    return this.store.mutate((state) => {
      const current = findJob(state, jobId)!
      current.versions.find((version) => version.id === versionId)!.approvalStatus = "rejected"
      const restored = current.versions.find((version) => version.id === fallback.id)!
      current.currentVersionId = restored.id
      current.previewRelativePath = restored.previewRelativePath
      current.previewReadyAt = restored.createdAt
      current.profile = structuredClone(restored.profile)
      current.adobeResources = structuredClone(restored.adobeResources)
      current.adjustments = structuredClone(restored.adjustments)
      current.automation = restored.automation
      current.origin = restored.origin
      current.status = restored.approvalStatus === "approved" ? "approved" : "review"
    })
  }

  private async queueReprocess(jobId: string, profile?: EditingProfile, adobeResources?: AdobeResourceSnapshot): Promise<WorkflowState> {
    const job = findJob(this.store.snapshot(), jobId)
    if (!job || !new Set(["review", "approved"]).has(job.status)) throw new Error("La edición no está lista para reprocesar.")
    const result = await this.store.mutate((state) => {
      const current = findJob(state, jobId)!
      if (profile) {
        current.profile = structuredClone(profile)
        current.adjustments = structuredClone(profile.defaults)
      }
      if (adobeResources) current.adobeResources = structuredClone(adobeResources)
      current.status = "queued"
      current.previewRelativePath = null
      current.previewReadyAt = null
      current.finishedAt = null
      current.error = null
    })
    this.schedule(jobId)
    return result
  }

  async approve(jobId: string, versionId?: string): Promise<WorkflowState> {
    const snapshot = this.store.snapshot()
    const job = findJob(snapshot, jobId)
    const version = job?.versions.find((item) => item.id === (versionId ?? job.currentVersionId))
    if (!job || !version) throw new Error("La versión todavía no está lista para aprobar.")
    const fullOutputAlreadyValidated = version.engine === "adobe" && Boolean(version.fullRelativePath)
    await this.store.mutate((state) => {
      const current = findJob(state, jobId)!
      for (const item of current.versions) {
        if (item.approvalStatus === "approved") item.approvalStatus = "superseded"
      }
      const selected = current.versions.find((item) => item.id === version.id)!
      selected.approvalStatus = "approved"
      selected.approvedAt = new Date().toISOString()
      selected.deliveryStatus = fullOutputAlreadyValidated ? "ready" : "generating"
      selected.deliveryError = null
      current.approvedVersionId = selected.id
      current.status = "approved"
      current.approvedAt = selected.approvedAt
    })
    const result = this.store.snapshot()
    if (!fullOutputAlreadyValidated) this.scheduleDelivery(jobId, version.id)
    return result
  }

  async revokeApproval(jobId: string): Promise<WorkflowState> {
    const job = findJob(this.store.snapshot(), jobId)
    if (!job?.approvedVersionId) throw new Error("La edición no tiene una aprobación vigente.")
    return this.store.mutate((state) => {
      const current = findJob(state, jobId)!
      const version = current.versions.find((item) => item.id === current.approvedVersionId)!
      version.approvalStatus = "revoked"
      version.revokedAt = new Date().toISOString()
      current.approvedVersionId = null
      current.approvedAt = null
      current.status = "review"
    })
  }

  async retryDelivery(jobId: string): Promise<WorkflowState> {
    const job = findJob(this.store.snapshot(), jobId)
    const version = job?.versions.find((item) => item.id === job.approvedVersionId)
    if (!job || !version || version.deliveryStatus !== "failed") throw new Error("No existe una entrega fallida para reintentar.")
    await this.store.mutate((state) => {
      const current = findJob(state, jobId)!
      const selected = current.versions.find((item) => item.id === version.id)!
      selected.deliveryStatus = "generating"
      selected.deliveryError = null
    })
    const result = this.store.snapshot()
    this.scheduleDelivery(jobId, version.id)
    return result
  }

  async simulateInterruptedState(jobId: string): Promise<WorkflowState> {
    const job = findJob(this.store.snapshot(), jobId)
    if (!job || !new Set(["review", "approved", "failed", "cancelled"]).has(job.status)) {
      throw new Error("El trabajo no puede prepararse para una recuperación controlada.")
    }
    await this.removePartialResult(job)
    return this.store.mutate((state) => {
      const current = findJob(state, jobId)!
      current.status = "processing"
      current.startedAt = new Date().toISOString()
      current.finishedAt = null
      current.previewReadyAt = null
      current.approvedAt = null
      current.previewRelativePath = null
      current.error = null
    })
  }

  async waitForIdle(): Promise<void> {
    while (this.drainPromise) await this.drainPromise
  }

  private startDrain(): void {
    if (this.drainPromise) return
    this.drainPromise = this.drain().finally(() => {
      this.drainPromise = null
      if (this.queue.length > 0 && !this.manualCorrectionJobId) this.startDrain()
    })
  }

  private async drain(): Promise<void> {
    while (this.queue.length > 0) {
      const operation = this.queue.shift()!
      const queuedJob = findJob(this.store.snapshot(), operation.jobId)
      if (this.manualCorrectionJobId && queuedJob?.engine === "adobe") {
        this.queue.unshift(operation)
        return
      }
      this.currentOperation = operation
      try {
        if (operation.kind === "preview") await this.process(operation.jobId)
        else await this.generateDelivery(operation.jobId, operation.versionId)
      } finally {
        this.currentOperation = null
      }
    }
  }

  private async process(jobId: string): Promise<void> {
    let temporaryPath: string | null = null
    let fullTemporaryPath: string | null = null
    let portraitResult: PortraitResult | null = null
    let lensCorrectionApplied = false
    let processingRoute: ProcessingRoute = "cpu"
    let usedRawFallback = false
    let fullWidth: number | null = null
    let fullHeight: number | null = null
    let warningTimer: ReturnType<typeof setTimeout> | null = null
    // Mantener corto el nombre físico: libvips no abre algunas rutas largas en Windows.
    const attemptToken = crypto.randomUUID().slice(0, 8)
    this.activeAttemptTokens.set(jobId, attemptToken)
    try {
      if (this.controlledProcessingDelayMilliseconds > 0) {
        await this.delayUntilCancelled(jobId, Math.ceil(this.controlledProcessingDelayMilliseconds / 2))
      }
      if (this.cancellationRequests.has(jobId)) return
      await this.store.mutate((state) => {
        const job = findJob(state, jobId)
        if (!job || job.status !== "queued") throw new Error("El trabajo de edición ya no está disponible.")
        job.status = "processing"
        job.startedAt = new Date().toISOString()
        job.finishedAt = null
        job.attempts += 1
        job.metrics.retries = Math.max(0, job.attempts - 1)
        job.error = null
      })
      warningTimer = setTimeout(() => {
        void this.store.mutate((state) => {
          const delayed = findJob(state, jobId)
          if (!delayed || delayed.status !== "processing") return
          delayed.metrics.delays += 1
        }).catch(() => undefined)
      }, this.delayWarningMilliseconds)
      if (this.controlledProcessingDelayMilliseconds > 0) {
        await this.delayUntilCancelled(jobId, Math.min(this.controlledProcessingDelayMilliseconds, this.processingTimeoutMilliseconds))
        const startedAt = findJob(this.store.snapshot(), jobId)?.startedAt
        if (startedAt && Date.now() - new Date(startedAt).getTime() >= this.processingTimeoutMilliseconds) {
          throw new EditingTimeoutError("Photoshop excedió el límite de dos minutos y el trabajo fue interrumpido.")
        }
      }
      if (this.cancellationRequests.has(jobId)) return
      if (this.controlledFailurePending) {
        this.controlledFailurePending = false
        throw new Error("Fallo controlado de edición.")
      }

      const current = this.store.snapshot()
      const job = findJob(current, jobId)
      const capture = job ? captureById(current, job.captureId) : null
      if (!job || !capture?.jpegRelativePath) {
        throw new Error("La fotografía principal necesita su JPEG asociado para generar la vista previa.")
      }

      const versionNumber = job.versions.length + 1
      const previewRelativePath = this.previewRelativePath(job, versionNumber)
      const previewPath = path.join(this.dataDirectory, previewRelativePath)
      temporaryPath = `${previewPath}.${attemptToken}.tmp`
      const engine = this.engineFor(job.engine)
      const fullRelativePath = engine.outputStrategy === "full-once"
        ? path.join("events", job.eventId, "sessions", job.sessionId, "edits", `${job.id}-v${versionNumber}-full.jpg`)
        : null
      const fullPath = fullRelativePath ? path.join(this.dataDirectory, fullRelativePath) : null
      fullTemporaryPath = fullPath ? `${fullPath}.${attemptToken}.tmp` : null
      await mkdir(path.dirname(previewPath), { recursive: true })
      const origin: "raw" | "jpeg" = job.jpegFallbackDecision === "authorized" || capture.emergencyJpegAuthorized ? "jpeg" : "raw"
      await this.assertCanFinish()
      try {
        const attemptPaths = [temporaryPath, ...(fullTemporaryPath ? [fullTemporaryPath] : [])]
        const render = (signal?: AbortSignal) =>
          engine.render(job, capture, fullTemporaryPath ?? temporaryPath!, origin, fullTemporaryPath === null, signal)
        const rendered = job.engine === "adobe"
          ? await this.renderWithControls(jobId, attemptToken, attemptPaths, render)
          : await render()
        portraitResult = rendered.portraitResult
        lensCorrectionApplied = rendered.lensCorrectionApplied
        processingRoute = rendered.processingRoute
        usedRawFallback = rendered.usedRawFallback
        if (fullTemporaryPath) {
          const metadata = await sharp(fullTemporaryPath).metadata()
          fullWidth = metadata.width ?? null
          fullHeight = metadata.height ?? null
          await sharp(fullTemporaryPath)
            .rotate()
            .resize(960, 960, { fit: "inside", withoutEnlargement: true })
            .toColourspace("srgb")
            .jpeg({ quality: 86, chromaSubsampling: "4:4:4" })
            .toFile(temporaryPath)
        }
      } catch (error) {
        if (!(error instanceof RawDevelopmentError)) throw error
        await this.store.mutate((state) => {
          const waiting = findJob(state, jobId)
          if (!waiting || waiting.status !== "processing") return
          waiting.status = "awaiting-jpeg-authorization"
          waiting.rawIssue = error.kind
          waiting.jpegFallbackDecision = "pending"
          waiting.origin = null
          waiting.finishedAt = new Date().toISOString()
          waiting.error = error.message
        })
        return
      }
      if (this.cancellationRequests.has(jobId)) {
        await rm(temporaryPath, { force: true })
        if (fullTemporaryPath) await rm(fullTemporaryPath, { force: true })
        temporaryPath = null
        fullTemporaryPath = null
        return
      }
      await this.assertCanFinish()
      if (fullTemporaryPath && fullPath) {
        await rename(fullTemporaryPath, fullPath)
        fullTemporaryPath = null
      }
      await rename(temporaryPath, previewPath)
      temporaryPath = null

      await this.store.mutate((state) => {
        const completed = findJob(state, jobId)
        if (!completed || completed.status !== "processing") return
        completed.status = "review"
        completed.previewRelativePath = previewRelativePath
        completed.previewReadyAt = new Date().toISOString()
        completed.finishedAt = completed.previewReadyAt
        completed.error = null
        completed.origin = origin
        completed.rawIssue = null
        completed.jpegFallbackDecision = origin === "jpeg" ? "authorized" : "not-needed"
        const version = {
          id: crypto.randomUUID(),
          number: versionNumber,
          createdAt: completed.previewReadyAt!,
          profile: structuredClone(completed.profile),
          adobeResources: structuredClone(completed.adobeResources),
          adjustments: structuredClone(completed.adjustments),
          engine: completed.engine,
          automation: completed.automation,
          origin: origin!,
          previewRelativePath,
          approvalStatus: "review" as const,
          approvedAt: null,
          revokedAt: null,
          fullRelativePath,
          deliveryStatus: "not-requested" as const,
          deliveryError: null,
          width: fullWidth,
          height: fullHeight,
          backupStatus: "pending" as const,
          backupError: null,
        }
        completed.versions.push(version)
        completed.currentVersionId = version.id
        completed.faceCount = portraitResult?.faces ?? 0
        completed.portraitWarnings = portraitResult?.warnings ?? []
        completed.backdropCompletion = portraitResult?.backdrop ?? "omitted"
        completed.backdropDiagnostics = portraitResult?.backdropDiagnostics ?? null
        completed.adaptiveTone = portraitResult?.adaptiveTone ?? null
        completed.eyeEnhancementEnabled = portraitResult?.eyesEnhanced === true
        completed.teethWhiteningEnabled = portraitResult?.teethWhitened === true
        completed.lensCorrectionApplied = lensCorrectionApplied
        completed.metrics.processingRoute = processingRoute
        completed.accelerationWarning = processingRoute === "gpu" || processingRoute === "hybrid"
          ? null
          : usedRawFallback
            ? "darktable no pudo usarse; la edición continuó mediante el respaldo rawpy por CPU."
            : "Ruta CPU activa; la edición sigue disponible con menor rendimiento."
        completed.metrics.previewMilliseconds = Date.now() - new Date(completed.startedAt!).getTime()
        completed.metrics.lastAttemptMilliseconds = completed.metrics.previewMilliseconds
        if (fullRelativePath) completed.metrics.deliveryMilliseconds = completed.metrics.previewMilliseconds
      })
    } catch (error) {
      if (temporaryPath) await rm(temporaryPath, { force: true }).catch(() => undefined)
      if (fullTemporaryPath) await rm(fullTemporaryPath, { force: true }).catch(() => undefined)
      if (!this.cancellationRequests.has(jobId)) {
        await this.store.mutate((state) => {
          const job = findJob(state, jobId)
          if (!job || job.status === "cancelled") return
          const timedOut = error instanceof EditingTimeoutError
          job.status = timedOut ? "interrupted" : "failed"
          job.finishedAt = new Date().toISOString()
          job.error = error instanceof Error ? error.message : "No se pudo generar la primera edición."
          job.metrics.lastAttemptMilliseconds = job.startedAt ? Date.now() - new Date(job.startedAt).getTime() : null
          if (timedOut) job.metrics.timeouts += 1
          else job.metrics.failures += 1
        }).catch(() => undefined)
      }
    } finally {
      if (warningTimer) clearTimeout(warningTimer)
      this.cancellationRequests.delete(jobId)
      if (this.activeAttemptTokens.get(jobId) === attemptToken) this.activeAttemptTokens.delete(jobId)
    }
  }

  private previewRelativePath(job: EditingJob, versionNumber = job.versions.length + 1): string {
    return path.join("events", job.eventId, "sessions", job.sessionId, "edits", `${job.id}-v${versionNumber}-preview.jpg`)
  }

  private async removePartialResult(job: EditingJob): Promise<void> {
    const previewPath = path.join(this.dataDirectory, this.previewRelativePath(job))
    const fullPath = path.join(this.dataDirectory, "events", job.eventId, "sessions", job.sessionId, "edits", `${job.id}-v${job.versions.length + 1}-full.jpg`)
    const directory = path.dirname(previewPath)
    const attemptFiles = await readdir(directory).catch(() => [])
    const activeAttemptToken = this.activeAttemptTokens.get(job.id)
    await Promise.all([
      rm(previewPath, { force: true }),
      rm(`${previewPath}.tmp`, { force: true }),
      rm(`${previewPath}.tmp.raw.png`, { force: true }),
      rm(`${previewPath}.tmp.raw.tif`, { force: true }),
      rm(`${previewPath}.tmp.styled.jpg`, { force: true }),
      rm(`${previewPath}.tmp.portrait.jpg`, { force: true }),
      rm(`${fullPath}.tmp`, { force: true }),
      ...attemptFiles
        .filter((name) => name.startsWith(`${job.id}-v${job.versions.length + 1}-preview.jpg.`) || name.startsWith(`${job.id}-v${job.versions.length + 1}-full.jpg.`))
        .filter((name) => !activeAttemptToken || !name.includes(`.${activeAttemptToken}.tmp`))
        .map((name) => rm(path.join(directory, name), { force: true })),
    ])
  }

  private async renderWithControls<T>(
    jobId: string,
    attemptToken: string,
    attemptPaths: string[],
    render: (signal: AbortSignal) => Promise<T>,
  ): Promise<T> {
    const controller = new AbortController()
    let interrupt!: (error: Error) => void
    const interrupted = new Promise<never>((_resolve, reject) => { interrupt = reject })
    const active: ActiveRender = { controller, interrupt }
    this.activeRenders.set(jobId, active)
    const renderPromise = render(controller.signal)
    const timeout = setTimeout(() => {
      controller.abort()
      interrupt(new EditingTimeoutError("Photoshop excedió el límite de dos minutos y el trabajo fue interrumpido."))
    }, this.processingTimeoutMilliseconds)
    try {
      return await Promise.race([renderPromise, interrupted])
    } catch (error) {
      if (error instanceof EditingTimeoutError || error instanceof EditingCancelledError) {
        void renderPromise.then(
          () => this.quarantineLateOutput(jobId, attemptToken, attemptPaths),
          () => this.quarantineLateOutput(jobId, attemptToken, attemptPaths),
        )
      }
      throw error
    } finally {
      clearTimeout(timeout)
      if (this.activeRenders.get(jobId) === active) this.activeRenders.delete(jobId)
    }
  }

  private async quarantineLateOutput(jobId: string, attemptToken: string, attemptPaths: string[]): Promise<void> {
    const quarantine = path.join(this.dataDirectory, "adobe-exchange", "quarantine")
    await mkdir(quarantine, { recursive: true })
    let isolated = 0
    for (const attemptPath of attemptPaths) {
      const target = path.join(quarantine, `${jobId}-${attemptToken}-${path.basename(attemptPath)}`)
      try {
        await rename(attemptPath, target)
        isolated += 1
      } catch {
        // El motor abortado puede no haber llegado a escribir ningún parcial.
      }
    }
    if (isolated === 0) return
    await this.store.mutate((state) => {
      const job = findJob(state, jobId)
      if (job) job.metrics.lateOutputs += isolated
    }).catch(() => undefined)
  }

  private async delay(milliseconds: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, milliseconds))
  }

  private async delayUntilCancelled(jobId: string, milliseconds: number): Promise<void> {
    const deadline = Date.now() + milliseconds
    while (!this.cancellationRequests.has(jobId) && Date.now() < deadline) {
      await this.delay(Math.min(25, deadline - Date.now()))
    }
  }

  private async generateDelivery(jobId: string, versionId: string): Promise<WorkflowState> {
    const deliveryStartedAt = Date.now()
    const snapshot = this.store.snapshot()
    const job = findJob(snapshot, jobId)!
    const version = job.versions.find((item) => item.id === versionId)!
    const capture = captureById(snapshot, job.captureId)
    if (!capture) throw new Error("La fotografía original asociada ya no está disponible.")
    const fullRelativePath = path.join("events", job.eventId, "sessions", job.sessionId, "edits", `${job.id}-v${version.number}-full.jpg`)
    const fullPath = path.join(this.dataDirectory, fullRelativePath)
    const temporaryPath = `${fullPath}.tmp`
    try {
      if (this.controlledDeliveryFailurePending) {
        this.controlledDeliveryFailurePending = false
        throw new Error("Fallo controlado al generar el JPEG completo.")
      }
      await this.assertCanFinish()
      const renderJob: EditingJob = {
        ...job,
        engine: version.engine,
        profile: structuredClone(version.profile),
        adjustments: structuredClone(version.adjustments),
      }
      await this.engineFor(version.engine).render(renderJob, capture, temporaryPath, version.origin, false)
      await this.assertCanFinish()
      const metadata = await sharp(temporaryPath).metadata()
      const previewMetadata = await sharp(path.join(this.dataDirectory, version.previewRelativePath)).metadata()
      if (
        metadata.format !== "jpeg" || !metadata.width || !metadata.height ||
        !previewMetadata.width || !previewMetadata.height ||
        metadata.width < previewMetadata.width || metadata.height < previewMetadata.height
      ) throw new Error("El JPEG completo no superó la validación de lectura, asociación y dimensiones esperadas.")
      await rename(temporaryPath, fullPath)
      return this.store.mutate((state) => {
        const current = findJob(state, jobId)!
        const selected = current.versions.find((item) => item.id === versionId)!
        selected.fullRelativePath = fullRelativePath
        selected.deliveryStatus = "ready"
        selected.deliveryError = null
        selected.width = metadata.width!
        selected.height = metadata.height!
        selected.backupStatus = "pending"
        selected.backupError = null
        current.metrics.deliveryMilliseconds = Date.now() - deliveryStartedAt
      })
    } catch (error) {
      await rm(temporaryPath, { force: true })
      return this.store.mutate((state) => {
        const current = findJob(state, jobId)!
        const selected = current.versions.find((item) => item.id === versionId)!
        selected.deliveryStatus = "failed"
        selected.deliveryError = error instanceof Error ? error.message : "No se pudo generar el JPEG completo."
        current.metrics.failures += 1
        current.metrics.deliveryMilliseconds = Date.now() - deliveryStartedAt
      })
    }
  }

  private engineFor(id: EditingJob["engine"]): EditingEngine {
    const engine = this.engines.get(id)
    if (!engine) throw new Error(`El motor ${id} no está disponible para este trabajo.`)
    return engine
  }
}
