import { mkdir, rename, rm } from "node:fs/promises"
import path from "node:path"
import sharp from "sharp"

import { captureById, type Capture, type EditingJob, type EditingProfile, type WorkflowState } from "../shared/workflow.js"
import { WorkflowStore } from "./workflow-store.js"
import { RawDeveloper, RawDevelopmentError } from "./raw-developer.js"
import { PortraitRetoucher, type PortraitFixture, type PortraitResult } from "./portrait-retoucher.js"

const findJob = (state: WorkflowState, id: string): EditingJob | null =>
  state.editingJobs.find((job) => job.id === id) ?? null

type EditingOperation =
  | { kind: "preview"; jobId: string }
  | { kind: "delivery"; jobId: string; versionId: string }

export class EditingService {
  private readonly queue: EditingOperation[] = []
  private readonly cancellationRequests = new Set<string>()
  private currentOperation: EditingOperation | null = null
  private drainPromise: Promise<void> | null = null
  private controlledFailurePending = false
  private controlledDeliveryFailurePending = false
  private readonly rawDeveloper: RawDeveloper
  private readonly portraitRetoucher: PortraitRetoucher

  constructor(
    private readonly store: WorkflowStore,
    private readonly dataDirectory: string,
    private readonly controlledProcessingDelayMilliseconds = 0,
    private readonly assertCanFinish: () => Promise<void> = async () => undefined,
    private readonly controlledPortraitFixture?: PortraitFixture,
  ) {
    this.rawDeveloper = new RawDeveloper(dataDirectory)
    this.portraitRetoucher = new PortraitRetoucher(path.join(dataDirectory, "models"))
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

  async reprocessWithProfile(jobId: string, profile: EditingProfile): Promise<WorkflowState> {
    return this.queueReprocess(jobId, profile)
  }

  private async queueReprocess(jobId: string, profile?: EditingProfile): Promise<WorkflowState> {
    const job = findJob(this.store.snapshot(), jobId)
    if (!job || !new Set(["review", "approved"]).has(job.status)) throw new Error("La edición no está lista para reprocesar.")
    const result = await this.store.mutate((state) => {
      const current = findJob(state, jobId)!
      if (profile) {
        current.profile = structuredClone(profile)
        current.adjustments = structuredClone(profile.defaults)
      }
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
    await this.store.mutate((state) => {
      const current = findJob(state, jobId)!
      for (const item of current.versions) {
        if (item.approvalStatus === "approved") item.approvalStatus = "superseded"
      }
      const selected = current.versions.find((item) => item.id === version.id)!
      selected.approvalStatus = "approved"
      selected.approvedAt = new Date().toISOString()
      selected.deliveryStatus = "generating"
      selected.deliveryError = null
      current.approvedVersionId = selected.id
      current.status = "approved"
      current.approvedAt = selected.approvedAt
    })
    const result = this.store.snapshot()
    this.scheduleDelivery(jobId, version.id)
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
      if (this.queue.length > 0) this.startDrain()
    })
  }

  private async drain(): Promise<void> {
    while (this.queue.length > 0) {
      const operation = this.queue.shift()!
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
    let portraitResult: PortraitResult | null = null
    let lensCorrectionApplied = false
    let processingRoute: "cpu" | "gpu" = "cpu"
    let usedRawFallback = false
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
      if (this.controlledProcessingDelayMilliseconds > 0) {
        await this.delayUntilCancelled(jobId, this.controlledProcessingDelayMilliseconds)
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
      temporaryPath = `${previewPath}.tmp`
      await mkdir(path.dirname(previewPath), { recursive: true })
      const origin: "raw" | "jpeg" = job.jpegFallbackDecision === "authorized" || capture.emergencyJpegAuthorized ? "jpeg" : "raw"
      await this.assertCanFinish()
      try {
        const rendered = await this.renderEditedImage(job, capture, temporaryPath, origin, true)
        portraitResult = rendered.portraitResult
        lensCorrectionApplied = rendered.lensCorrectionApplied
        processingRoute = rendered.processingRoute
        usedRawFallback = rendered.usedRawFallback
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
        temporaryPath = null
        return
      }
      await this.assertCanFinish()
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
          adjustments: structuredClone(completed.adjustments),
          origin: origin!,
          previewRelativePath,
          approvalStatus: "review" as const,
          approvedAt: null,
          revokedAt: null,
          fullRelativePath: null,
          deliveryStatus: "not-requested" as const,
          deliveryError: null,
          width: null,
          height: null,
          backupStatus: "pending" as const,
          backupError: null,
        }
        completed.versions.push(version)
        completed.currentVersionId = version.id
        completed.faceCount = portraitResult?.faces ?? 0
        completed.portraitWarnings = portraitResult?.warnings ?? []
        completed.backdropCompletion = portraitResult?.backdrop ?? "omitted"
        completed.lensCorrectionApplied = lensCorrectionApplied
        completed.metrics.processingRoute = processingRoute
        completed.accelerationWarning = processingRoute === "gpu"
          ? null
          : usedRawFallback
            ? "darktable no pudo usarse; la edición continuó mediante el respaldo rawpy por CPU."
            : "Ruta CPU activa; la edición sigue disponible con menor rendimiento."
        completed.metrics.previewMilliseconds = Date.now() - new Date(completed.startedAt!).getTime()
      })
    } catch (error) {
      if (temporaryPath) await rm(temporaryPath, { force: true }).catch(() => undefined)
      if (!this.cancellationRequests.has(jobId)) {
        await this.store.mutate((state) => {
          const job = findJob(state, jobId)
          if (!job || job.status === "cancelled") return
          job.status = "failed"
          job.finishedAt = new Date().toISOString()
          job.error = error instanceof Error ? error.message : "No se pudo generar la primera edición."
          job.metrics.failures += 1
        }).catch(() => undefined)
      }
    } finally {
      this.cancellationRequests.delete(jobId)
    }
  }

  private previewRelativePath(job: EditingJob, versionNumber = job.versions.length + 1): string {
    return path.join("events", job.eventId, "sessions", job.sessionId, "edits", `${job.id}-v${versionNumber}-preview.jpg`)
  }

  private async removePartialResult(job: EditingJob): Promise<void> {
    const previewPath = path.join(this.dataDirectory, this.previewRelativePath(job))
    await Promise.all([
      rm(previewPath, { force: true }),
      rm(`${previewPath}.tmp`, { force: true }),
      rm(`${previewPath}.tmp.raw.png`, { force: true }),
      rm(`${previewPath}.tmp.raw.tif`, { force: true }),
      rm(`${previewPath}.tmp.styled.jpg`, { force: true }),
      rm(`${previewPath}.tmp.portrait.jpg`, { force: true }),
    ])
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

  private async renderEditedImage(
    job: EditingJob,
    capture: Capture,
    destination: string,
    origin: "raw" | "jpeg",
    lightweight: boolean,
  ): Promise<{ lensCorrectionApplied: boolean; portraitResult: PortraitResult; processingRoute: "cpu" | "gpu"; usedRawFallback: boolean }> {
    if (!capture.jpegRelativePath) throw new Error("La fotografía necesita su JPEG asociado para generar la edición.")
    const jpegPath = path.join(this.dataDirectory, capture.jpegRelativePath)
    const developedRawPath = `${destination}.raw.tif`
    const styledPath = `${destination}.styled.jpg`
    const portraitPath = `${destination}.portrait.jpg`
    let sourceImagePath = jpegPath
    let lensCorrectionApplied = false
    let processingRoute: "cpu" | "gpu" = "cpu"
    let usedRawFallback = false
    try {
      if (origin === "raw") {
        const rawResult = await this.rawDeveloper.develop(capture.rawRelativePath, jpegPath, developedRawPath)
        sourceImagePath = developedRawPath
        lensCorrectionApplied = rawResult.lensCorrectionApplied
        processingRoute = rawResult.processingRoute
        usedRawFallback = rawResult.method === "rawpy"
      }
      const temperature = job.adjustments.temperature
      await sharp(sourceImagePath)
        .rotate()
        .recomb([
          [1 + temperature * 0.06, 0, 0],
          [0, 1, 0],
          [0, 0, 1 - temperature * 0.06],
        ])
        .gamma(1.06)
        .linear(0.96, 4)
        .modulate({
          brightness: 1.02 + job.adjustments.exposure * 0.1,
          saturation: 1.05 + job.adjustments.colorIntensity * 0.1,
        })
        .median(3)
        .sharpen({ sigma: 0.55, m1: 0.35, m2: 1 })
        .jpeg({ quality: 94, chromaSubsampling: "4:4:4" })
        .toFile(styledPath)
      const portraitResult = await this.portraitRetoucher.apply(
        styledPath,
        portraitPath,
        job.adjustments.skinSmoothing,
        capture.source === "simulated-folder" ? this.controlledPortraitFixture ?? { kind: "single" } : undefined,
      )
      let output = sharp(portraitPath).rotate().toColourspace("srgb")
      if (lightweight) output = output.resize(960, 960, { fit: "inside", withoutEnlargement: true })
      await output.jpeg({ quality: lightweight ? 86 : 94, chromaSubsampling: "4:4:4" }).toFile(destination)
      return { lensCorrectionApplied, portraitResult, processingRoute, usedRawFallback }
    } finally {
      await Promise.all([
        rm(developedRawPath, { force: true }),
        rm(styledPath, { force: true }),
        rm(portraitPath, { force: true }),
      ])
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
        profile: structuredClone(version.profile),
        adjustments: structuredClone(version.adjustments),
      }
      await this.renderEditedImage(renderJob, capture, temporaryPath, version.origin, false)
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
}
