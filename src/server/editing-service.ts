import { mkdir, rename, rm } from "node:fs/promises"
import path from "node:path"
import sharp from "sharp"

import { captureById, type Capture, type EditingJob, type EditingProfile, type ProcessDiagnostic, type WorkflowState } from "../shared/workflow.js"
import { WorkflowStore } from "./workflow-store.js"
import { ensureEventPolishedRecipe } from "./event-polished-recipe.js"
import { sha256File } from "./file-hash.js"
import { RawDeveloper, RawDevelopmentError } from "./raw-developer.js"
import { PortraitRetoucher, type PortraitFixture, type PortraitResult } from "./portrait-retoucher.js"

const findJob = (state: WorkflowState, id: string): EditingJob | null =>
  state.editingJobs.find((job) => job.id === id) ?? null

type EditingOperation =
  | { kind: "preview"; jobId: string }
  | { kind: "delivery"; jobId: string; versionId: string }

type MasterProvenance = {
  developer: "controlled" | "darktable" | "rawpy" | "jpeg"
  developerVersion: string
  developerParameters: Record<string, string | number | boolean>
  developmentWarnings: string[]
  recipeRelativePath: string
  recipeVersion: number
  recipeSha256: string
  masterRelativePath: string
  masterSha256: string
  previewSha256: string
}

export class EditingService {
  private readonly queue: EditingOperation[] = []
  private readonly cancellationRequests = new Set<string>()
  private currentOperation: EditingOperation | null = null
  private drainPromise: Promise<void> | null = null
  private controlledFailurePending = false
  private controlledDeliveryFailurePending = false
  private readonly activeProcessControllers = new Map<string, AbortController>()
  private readonly rawDeveloper: RawDeveloper
  private readonly portraitRetoucher: PortraitRetoucher

  constructor(
    private readonly store: WorkflowStore,
    private readonly dataDirectory: string,
    private readonly controlledProcessingDelayMilliseconds = 0,
    private readonly controlledDeliveryDelayMilliseconds = 0,
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
    this.activeProcessControllers.get(jobId)?.abort()
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
    if (!job || !new Set(["failed", "interrupted"]).has(job.status)) {
      throw new Error("Solo puedes reintentar una edición fallida o interrumpida.")
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
    if (!job || !version || job.status === "rejected" || version.approvalStatus === "rejected") {
      throw new Error("La versión todavía no está lista para aprobar.")
    }
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

  async reject(jobId: string, versionId?: string): Promise<WorkflowState> {
    const snapshot = this.store.snapshot()
    const job = findJob(snapshot, jobId)
    const version = job?.versions.find((item) => item.id === (versionId ?? job.currentVersionId))
    if (!job || job.status !== "review" || !version || !new Set(["review", "revoked"]).has(version.approvalStatus)) {
      throw new Error("La versión todavía no está lista para rechazar.")
    }
    const result = await this.store.mutate((state) => {
      const current = findJob(state, jobId)!
      const selected = current.versions.find((item) => item.id === version.id)!
      selected.approvalStatus = "rejected"
      selected.revokedAt = null
      selected.fullRelativePath = null
      selected.deliveryStatus = "not-requested"
      selected.deliveryError = null
      selected.width = null
      selected.height = null
      current.status = "rejected"
      current.approvedVersionId = null
      current.approvedAt = null
      current.finishedAt = new Date().toISOString()
    })
    await this.removeDeliveryResult(job, version)
    return result
  }

  async revokeApproval(jobId: string): Promise<WorkflowState> {
    const job = findJob(this.store.snapshot(), jobId)
    if (!job?.approvedVersionId) throw new Error("La edición no tiene una aprobación vigente.")
    const version = job.versions.find((item) => item.id === job.approvedVersionId)!
    const deliveryWasGenerating = version.deliveryStatus === "generating"
    const result = await this.store.mutate((state) => {
      const current = findJob(state, jobId)!
      const selected = current.versions.find((item) => item.id === current.approvedVersionId)!
      selected.approvalStatus = "revoked"
      selected.revokedAt = new Date().toISOString()
      if (selected.deliveryStatus === "generating") {
        selected.deliveryStatus = "not-requested"
        selected.deliveryError = null
        selected.fullRelativePath = null
        selected.width = null
        selected.height = null
      }
      current.approvedVersionId = null
      current.approvedAt = null
      current.status = "review"
    })
    if (deliveryWasGenerating) await this.removeDeliveryResult(job, version)
    return result
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
    let temporaryMasterPath: string | null = null
    let publishedMasterPath: string | null = null
    let portraitResult: PortraitResult | null = null
    let lensCorrectionApplied = false
    let processingRoute: "cpu" | "gpu" = "cpu"
    let accelerationEvidence: EditingJob["accelerationEvidence"] = "inconclusive"
    let usedRawFallback = false
    const processDiagnostics: ProcessDiagnostic[] = []
    let provenance: MasterProvenance | null = null
    let developmentMilliseconds = 0
    let exportMilliseconds = 0
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
      const masterRelativePath = path.join("events", job.eventId, "sessions", job.sessionId, "edits", `${job.id}-v${versionNumber}-master.tif`)
      const masterPath = path.join(this.dataDirectory, masterRelativePath)
      temporaryMasterPath = `${masterPath}.tmp.tif`
      await mkdir(path.dirname(previewPath), { recursive: true })
      const origin: "raw" | "jpeg" = job.jpegFallbackDecision === "authorized" || capture.emergencyJpegAuthorized ? "jpeg" : "raw"
      await this.assertCanFinish()
      try {
        const processController = new AbortController()
        this.activeProcessControllers.set(jobId, processController)
        const rendered = await this.renderMaster(job, capture, temporaryMasterPath, origin, processController.signal, (diagnostic) => processDiagnostics.push(diagnostic))
        portraitResult = rendered.portraitResult
        developmentMilliseconds = rendered.developmentMilliseconds
        lensCorrectionApplied = rendered.lensCorrectionApplied
        processingRoute = rendered.processingRoute
        accelerationEvidence = rendered.accelerationEvidence
        usedRawFallback = rendered.usedRawFallback
        await this.validateMaster(temporaryMasterPath)
        await rm(masterPath, { force: true })
        await rename(temporaryMasterPath, masterPath)
        publishedMasterPath = masterPath
        temporaryMasterPath = null
        const exportStartedAt = Date.now()
        await sharp(masterPath).rotate().toColourspace("srgb").resize(960, 960, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 86, chromaSubsampling: "4:4:4" }).toFile(temporaryPath)
        exportMilliseconds = Date.now() - exportStartedAt
        const masterSha256 = await sha256File(masterPath)
        const previewSha256 = await sha256File(temporaryPath)
        rendered.provenance.masterSha256 = masterSha256
        rendered.provenance.previewSha256 = previewSha256
        rendered.provenance.masterRelativePath = masterRelativePath
        provenance = rendered.provenance
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
          waiting.processDiagnostics.push(...processDiagnostics)
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
          previewSha256: provenance!.previewSha256,
          previewMasterSha256: provenance!.masterSha256,
          masterId: `master-${provenance!.masterSha256}`,
          masterRelativePath: provenance!.masterRelativePath,
          masterSha256: provenance!.masterSha256,
          originalSha256: origin === "raw" ? capture.rawSha256 : capture.jpegSha256,
          recipeRelativePath: provenance!.recipeRelativePath,
          recipeVersion: provenance!.recipeVersion,
          recipeSha256: provenance!.recipeSha256,
          developer: provenance!.developer,
          developerVersion: provenance!.developerVersion,
          developerParameters: provenance!.developerParameters,
          developmentWarnings: provenance!.developmentWarnings,
          iccProfile: "sRGB",
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
        if (portraitResult) completed.retouchDecisions = portraitResult.operations
        completed.lensCorrectionApplied = lensCorrectionApplied
        completed.processDiagnostics.push(...processDiagnostics)
        completed.metrics.processingRoute = processingRoute
        completed.accelerationEvidence = accelerationEvidence
        completed.metrics.stages = {
          ...(portraitResult?.stageMilliseconds ?? completed.metrics.stages),
          development: developmentMilliseconds,
          export: exportMilliseconds,
        }
        completed.accelerationWarning = processingRoute === "gpu"
          ? null
          : usedRawFallback
            ? "darktable no pudo usarse; la edición continuó mediante el respaldo rawpy por CPU."
            : "Ruta CPU activa; la edición sigue disponible con menor rendimiento."
        completed.metrics.previewMilliseconds = Date.now() - new Date(completed.startedAt!).getTime()
      })
      publishedMasterPath = null
    } catch (error) {
      if (temporaryPath) await rm(temporaryPath, { force: true }).catch(() => undefined)
      if (temporaryMasterPath) await rm(temporaryMasterPath, { force: true }).catch(() => undefined)
      if (publishedMasterPath) await rm(publishedMasterPath, { force: true }).catch(() => undefined)
      if (this.cancellationRequests.has(jobId)) {
        await this.store.mutate((state) => {
          const job = findJob(state, jobId)
          if (job) job.processDiagnostics.push(...processDiagnostics)
        }).catch(() => undefined)
      } else {
        await this.store.mutate((state) => {
          const job = findJob(state, jobId)
          if (!job || job.status === "cancelled") return
          job.status = "failed"
          job.finishedAt = new Date().toISOString()
          job.error = error instanceof Error ? error.message : "No se pudo generar la primera edición."
          job.processDiagnostics.push(...processDiagnostics)
          job.metrics.failures += 1
        }).catch(() => undefined)
      }
    } finally {
      this.activeProcessControllers.delete(jobId)
      this.cancellationRequests.delete(jobId)
    }
  }

  private previewRelativePath(job: EditingJob, versionNumber = job.versions.length + 1): string {
    return path.join("events", job.eventId, "sessions", job.sessionId, "edits", `${job.id}-v${versionNumber}-preview.jpg`)
  }

  private masterRelativePath(job: EditingJob, versionNumber = job.versions.length + 1): string {
    return path.join("events", job.eventId, "sessions", job.sessionId, "edits", `${job.id}-v${versionNumber}-master.tif`)
  }

  private async removePartialResult(job: EditingJob): Promise<void> {
    const previewPath = path.join(this.dataDirectory, this.previewRelativePath(job))
    const masterPath = path.join(this.dataDirectory, this.masterRelativePath(job))
    await Promise.all([
      rm(previewPath, { force: true }),
      rm(`${previewPath}.tmp`, { force: true }),
      rm(`${previewPath}.tmp.raw.png`, { force: true }),
      rm(`${previewPath}.tmp.raw.tif`, { force: true }),
      rm(`${previewPath}.tmp.styled.jpg`, { force: true }),
      rm(`${previewPath}.tmp.portrait.jpg`, { force: true }),
      rm(masterPath, { force: true }),
      rm(`${masterPath}.tmp.tif`, { force: true }),
      rm(`${masterPath}.tmp.tif.developed.tif`, { force: true }),
      rm(`${masterPath}.tmp.tif.recipe.tif`, { force: true }),
      rm(`${masterPath}.tmp.tif.portrait.tif`, { force: true }),
    ])
  }

  private async removeDeliveryResult(job: EditingJob, version: EditingJob["versions"][number]): Promise<void> {
    this.activeProcessControllers.get(job.id)?.abort()
    for (let index = this.queue.length - 1; index >= 0; index -= 1) {
      const operation = this.queue[index]
      if (operation.kind === "delivery" && operation.jobId === job.id && operation.versionId === version.id) this.queue.splice(index, 1)
    }
    const fullRelativePath = version.fullRelativePath ?? path.join("events", job.eventId, "sessions", job.sessionId, "edits", `${job.id}-v${version.number}-full.jpg`)
    const fullPath = path.join(this.dataDirectory, fullRelativePath)
    await Promise.all([rm(fullPath, { force: true }), rm(`${fullPath}.tmp`, { force: true })])
  }

  private deliveryIsApproved(jobId: string, versionId: string): boolean {
    const job = findJob(this.store.snapshot(), jobId)
    const version = job?.versions.find((item) => item.id === versionId)
    return job?.status === "approved" && job.approvedVersionId === versionId && version?.approvalStatus === "approved"
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

  private async renderMaster(
    job: EditingJob,
    capture: Capture,
    destination: string,
    origin: "raw" | "jpeg",
    signal?: AbortSignal,
    onDiagnostic?: (diagnostic: ProcessDiagnostic) => void,
  ): Promise<{ lensCorrectionApplied: boolean; portraitResult: PortraitResult; processingRoute: "cpu" | "gpu"; accelerationEvidence: EditingJob["accelerationEvidence"]; usedRawFallback: boolean; developmentMilliseconds: number; provenance: MasterProvenance }> {
    if (!capture.jpegRelativePath) throw new Error("La fotografía necesita su JPEG asociado para generar la edición.")
    const jpegPath = path.join(this.dataDirectory, capture.jpegRelativePath)
    const developedPath = `${destination}.developed.tif`
    const recipeAppliedPath = `${destination}.recipe.tif`
    const portraitPath = `${destination}.portrait.tif`
    const profiledPath = `${destination}.profiled.tif`
    const recipe = await ensureEventPolishedRecipe(this.dataDirectory)
    let sourceImagePath = developedPath
    let lensCorrectionApplied = false
    let processingRoute: "cpu" | "gpu" = "cpu"
    let usedRawFallback = false
    let accelerationEvidence: EditingJob["accelerationEvidence"] = origin === "jpeg" ? "cpu" : "inconclusive"
    let developer: MasterProvenance["developer"] = "jpeg"
    let developerVersion = "jpeg-input"
    let developerParameters: Record<string, string | number | boolean> = { source: "authorized JPEG", conversion: "TIFF 16-bit sRGB" }
    let developmentWarnings = origin === "jpeg" ? ["Origen JPEG autorizado: hay menos rango tonal y margen de corrección que con RAW."] : []
    const developmentStartedAt = Date.now()
    try {
      if (origin === "raw") {
        const rawResult = await this.rawDeveloper.develop(capture.rawRelativePath, jpegPath, recipe.path, developedPath, signal, onDiagnostic)
        lensCorrectionApplied = rawResult.lensCorrectionApplied
        processingRoute = rawResult.processingRoute
        usedRawFallback = rawResult.method === "rawpy"
        developer = rawResult.method
        developerVersion = rawResult.developerVersion
        developerParameters = rawResult.parameters
        developmentWarnings = rawResult.warnings
        accelerationEvidence = rawResult.accelerationEvidence
      } else {
        await sharp(jpegPath).rotate().toColourspace("rgb16").tiff({ compression: "lzw" }).toFile(developedPath)
      }
      if (developer !== "darktable") {
        await sharp(developedPath)
          .rotate()
          .gamma(1.08)
          .linear(0.97, 3)
          .modulate({ brightness: 1.04, saturation: 1.10 })
          .median(3)
          .sharpen({ sigma: 0.6, m1: 0.45, m2: 1.2 })
          .toColourspace("rgb16")
          .tiff({ compression: "lzw" })
          .toFile(recipeAppliedPath)
        sourceImagePath = recipeAppliedPath
      }
      const portraitResult = await this.portraitRetoucher.apply(
        sourceImagePath,
        portraitPath,
        job.adjustments.skinSmoothing,
        capture.source === "simulated-folder" ? this.controlledPortraitFixture ?? { kind: "single" } : undefined,
        signal,
        onDiagnostic,
      )
      await sharp(portraitPath).toColourspace("rgb16").withIccProfile("srgb").tiff({ compression: "lzw" }).toFile(profiledPath)
      await this.validateMaster(profiledPath)
      await rename(profiledPath, destination)
      return {
        lensCorrectionApplied,
        portraitResult,
        processingRoute,
        accelerationEvidence,
        usedRawFallback,
        developmentMilliseconds: Date.now() - developmentStartedAt,
        provenance: {
          developer,
          developerVersion,
          developerParameters,
          developmentWarnings,
          recipeRelativePath: recipe.relativePath,
          recipeVersion: recipe.version,
          recipeSha256: recipe.sha256,
          masterRelativePath: "",
          masterSha256: "",
          previewSha256: "",
        },
      }
    } finally {
      await Promise.all([
        rm(developedPath, { force: true }),
        rm(recipeAppliedPath, { force: true }),
        rm(portraitPath, { force: true }),
        rm(profiledPath, { force: true }),
      ])
    }
  }

  private async validateMaster(filePath: string): Promise<void> {
    const metadata = await sharp(filePath).metadata()
    if (metadata.format !== "tiff" || metadata.channels !== 3 || metadata.depth !== "ushort" || (metadata.space !== "rgb16" && metadata.space !== "srgb") || !metadata.icc || !metadata.width || !metadata.height) {
      throw new Error("El máster no es un TIFF sRGB legible de tres canales y 16 bits.")
    }
  }

  private async generateDelivery(jobId: string, versionId: string): Promise<WorkflowState> {
    const deliveryStartedAt = Date.now()
    const snapshot = this.store.snapshot()
    const job = findJob(snapshot, jobId)!
    const version = job.versions.find((item) => item.id === versionId)!
    if (!this.deliveryIsApproved(jobId, versionId)) return snapshot
    const capture = captureById(snapshot, job.captureId)
    if (!capture) throw new Error("La fotografía original asociada ya no está disponible.")
    if (!version.masterRelativePath || !version.masterSha256 || version.previewMasterSha256 !== version.masterSha256) {
      throw new Error("El máster asociado con la vista previa no está disponible o no es válido.")
    }
    const fullRelativePath = path.join("events", job.eventId, "sessions", job.sessionId, "edits", `${job.id}-v${version.number}-full.jpg`)
    const fullPath = path.join(this.dataDirectory, fullRelativePath)
    const temporaryPath = `${fullPath}.tmp`
    try {
      if (this.controlledDeliveryFailurePending) {
        this.controlledDeliveryFailurePending = false
        throw new Error("Fallo controlado al generar el JPEG completo.")
      }
      if (this.controlledDeliveryDelayMilliseconds > 0) await this.delay(this.controlledDeliveryDelayMilliseconds)
      await this.assertCanFinish()
      const masterPath = path.join(this.dataDirectory, version.masterRelativePath)
      await this.validateMaster(masterPath)
      if (await sha256File(masterPath) !== version.masterSha256) throw new Error("El hash del máster ya no coincide con la versión revisada.")
      const currentOriginalSha256 = version.origin === "raw" ? capture.rawSha256 : capture.jpegSha256
      if (!currentOriginalSha256 || currentOriginalSha256 !== version.originalSha256) throw new Error("El original asociado ya no coincide con la versión revisada.")
      await sharp(masterPath).rotate().toColourspace("srgb").jpeg({ quality: 94, chromaSubsampling: "4:4:4" }).toFile(temporaryPath)
      await this.assertCanFinish()
      const metadata = await sharp(temporaryPath).metadata()
      const previewMetadata = await sharp(path.join(this.dataDirectory, version.previewRelativePath)).metadata()
      if (
        metadata.format !== "jpeg" || !metadata.width || !metadata.height ||
        !previewMetadata.width || !previewMetadata.height ||
        metadata.width < previewMetadata.width || metadata.height < previewMetadata.height
      ) throw new Error("El JPEG completo no superó la validación de lectura, asociación y dimensiones esperadas.")
      if (!this.deliveryIsApproved(jobId, versionId)) {
        await rm(temporaryPath, { force: true })
        return this.store.snapshot()
      }
      await rename(temporaryPath, fullPath)
      let published = false
      const result = await this.store.mutate((state) => {
        const current = findJob(state, jobId)!
        const selected = current.versions.find((item) => item.id === versionId)!
        if (current.status !== "approved" || current.approvedVersionId !== versionId || selected.approvalStatus !== "approved") return
        selected.fullRelativePath = fullRelativePath
        selected.deliveryStatus = "ready"
        selected.deliveryError = null
        selected.width = metadata.width!
        selected.height = metadata.height!
        selected.backupStatus = "pending"
        selected.backupError = null
        current.metrics.deliveryMilliseconds = Date.now() - deliveryStartedAt
        published = true
      })
      if (!published) await rm(fullPath, { force: true })
      return result
    } catch (error) {
      await rm(temporaryPath, { force: true })
      if (!this.deliveryIsApproved(jobId, versionId)) {
        await rm(fullPath, { force: true })
        return this.store.snapshot()
      }
      return this.store.mutate((state) => {
        const current = findJob(state, jobId)!
        const selected = current.versions.find((item) => item.id === versionId)!
        selected.deliveryStatus = "failed"
        selected.deliveryError = error instanceof Error ? error.message : "No se pudo generar el JPEG completo."
        current.metrics.failures += 1
        current.metrics.deliveryMilliseconds = Date.now() - deliveryStartedAt
      })
    } finally {
      this.activeProcessControllers.delete(jobId)
    }
  }
}
