import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import path from "node:path"

import {
  emptyWorkflowState,
  isEditingEngineId,
  isBackdropCompletion,
  type Capture,
  type EditingJob,
  type Event,
  type Series,
  type WorkflowState,
  naturalEventProfile,
  smartStudioAdobeResources,
} from "../shared/workflow.js"

type UnknownRecord = Record<string, unknown>

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === "object" && value !== null

const upgradeCapture = (capture: UnknownRecord): Capture => {
  const rawRelativePath = typeof capture.rawRelativePath === "string" ? capture.rawRelativePath : null
  const jpegRelativePath = typeof capture.jpegRelativePath === "string" ? capture.jpegRelativePath : null
  return {
    ...(capture as Omit<Capture, "rawRelativePath" | "jpegRelativePath">),
    rawRelativePath,
    jpegRelativePath,
    rawSha256: typeof capture.rawSha256 === "string" ? capture.rawSha256 : null,
    jpegSha256: typeof capture.jpegSha256 === "string" ? capture.jpegSha256 : null,
    source: capture.source === "manual-folder" || capture.source === "sony-usb-folder"
      ? capture.source
      : "simulated-folder",
    status: rawRelativePath && jpegRelativePath ? "complete" : rawRelativePath ? "jpeg-pending" : "raw-pending",
    emergencyJpegAuthorized: capture.emergencyJpegAuthorized === true,
    excluded: capture.excluded === true,
    quality: isRecord(capture.quality)
      ? capture.quality as Capture["quality"]
      : null,
  }
}

const upgradeSeries = (series: UnknownRecord): Series => ({
  ...(series as Omit<Series, "captures" | "warnings">),
  captures: Array.isArray(series.captures)
    ? series.captures.filter(isRecord).map(upgradeCapture)
    : [],
  warnings: Array.isArray(series.warnings)
    ? series.warnings.filter((item): item is string => typeof item === "string")
    : [],
})

const upgradeEvent = (event: UnknownRecord): Event => ({
  ...(event as Omit<Event, "sessions">),
  sessions: Array.isArray(event.sessions)
    ? event.sessions.filter(isRecord).map((session) => ({
        ...(session as Event["sessions"][number]),
        series: Array.isArray(session.series)
          ? session.series.filter(isRecord).map(upgradeSeries)
          : [],
      }))
    : [],
  editingProfile: isRecord(event.editingProfile)
    ? event.editingProfile as Event["editingProfile"]
    : naturalEventProfile(),
  adobeResources: isRecord(event.adobeResources)
    ? event.adobeResources as Event["adobeResources"]
    : smartStudioAdobeResources(),
})

const upgradeEditingJobs = (value: unknown): EditingJob[] => {
  if (!Array.isArray(value)) return []
  return value.filter(isRecord).filter((job) =>
    typeof job.id === "string" &&
    typeof job.eventId === "string" &&
    typeof job.sessionId === "string" &&
    typeof job.captureId === "string",
  ).map((job) => {
    const profile = isRecord(job.profile) ? job.profile as EditingJob["profile"] : naturalEventProfile()
    const adjustments = isRecord(job.adjustments)
      ? job.adjustments as EditingJob["adjustments"]
      : naturalEventProfile().defaults
    const persistedMetrics = isRecord(job.metrics) ? job.metrics : {}
    const metrics: EditingJob["metrics"] = {
      processingRoute: persistedMetrics.processingRoute === "gpu" || persistedMetrics.processingRoute === "hybrid"
        ? persistedMetrics.processingRoute
        : "cpu",
      previewMilliseconds: typeof persistedMetrics.previewMilliseconds === "number" ? persistedMetrics.previewMilliseconds : null,
      deliveryMilliseconds: typeof persistedMetrics.deliveryMilliseconds === "number" ? persistedMetrics.deliveryMilliseconds : null,
      lastAttemptMilliseconds: typeof persistedMetrics.lastAttemptMilliseconds === "number" ? persistedMetrics.lastAttemptMilliseconds : null,
      failures: typeof persistedMetrics.failures === "number" ? persistedMetrics.failures : 0,
      retries: typeof persistedMetrics.retries === "number" ? persistedMetrics.retries : 0,
      delays: typeof persistedMetrics.delays === "number" ? persistedMetrics.delays : 0,
      timeouts: typeof persistedMetrics.timeouts === "number" ? persistedMetrics.timeouts : 0,
      lateOutputs: typeof persistedMetrics.lateOutputs === "number" ? persistedMetrics.lateOutputs : 0,
    }
    const legacyPreview = typeof job.previewRelativePath === "string" ? job.previewRelativePath : null
    const versions: EditingJob["versions"] = Array.isArray(job.versions)
      ? job.versions.filter(isRecord).map((version) => ({
          ...version,
          engine: isEditingEngineId(version.engine) ? version.engine : "local",
          automation: version.automation === "backdrop" ? "backdrop" : "natural",
          adobeResources: isRecord(version.adobeResources) ? version.adobeResources : smartStudioAdobeResources(),
          backupStatus: new Set(["pending", "verified", "failed"]).has(String(version.backupStatus)) ? version.backupStatus : "pending",
          backupError: typeof version.backupError === "string" ? version.backupError : null,
        } as EditingJob["versions"][number]))
      : legacyPreview
        ? [{
            id: crypto.randomUUID(), number: 1, createdAt: typeof job.previewReadyAt === "string" ? job.previewReadyAt : new Date(0).toISOString(),
            profile, adjustments, engine: "local", automation: "natural", origin: job.origin === "jpeg" ? "jpeg" : "raw", previewRelativePath: legacyPreview,
            adobeResources: smartStudioAdobeResources(),
            approvalStatus: job.status === "approved" ? "approved" : "review", approvedAt: typeof job.approvedAt === "string" ? job.approvedAt : null,
            revokedAt: null, fullRelativePath: null, deliveryStatus: "not-requested", deliveryError: null, width: null, height: null,
            backupStatus: "pending", backupError: null,
          } as EditingJob["versions"][number]]
        : []
    return ({
    id: job.id as string,
    eventId: job.eventId as string,
    sessionId: job.sessionId as string,
    captureId: job.captureId as string,
    status: new Set(["queued", "processing", "awaiting-engine-readiness", "awaiting-jpeg-authorization", "jpeg-rejected", "review", "approved", "failed", "interrupted", "cancelled"]).has(String(job.status))
      ? job.status as EditingJob["status"]
      : "failed",
    createdAt: typeof job.createdAt === "string" ? job.createdAt : new Date(0).toISOString(),
    startedAt: typeof job.startedAt === "string" ? job.startedAt : null,
    finishedAt: typeof job.finishedAt === "string" ? job.finishedAt : null,
    previewReadyAt: typeof job.previewReadyAt === "string" ? job.previewReadyAt : null,
    approvedAt: typeof job.approvedAt === "string" ? job.approvedAt : null,
    previewRelativePath: typeof job.previewRelativePath === "string" ? job.previewRelativePath : null,
    error: typeof job.error === "string" ? job.error : null,
    attempts: typeof job.attempts === "number" ? job.attempts : 0,
    engine: isEditingEngineId(job.engine) ? job.engine : "local",
    automation: job.automation === "backdrop" ? "backdrop" : "natural",
    engineFallbackDecision: new Set(["not-needed", "pending", "authorized", "rejected"]).has(String(job.engineFallbackDecision))
      ? job.engineFallbackDecision as EditingJob["engineFallbackDecision"]
      : "not-needed",
    origin: job.origin === "raw" || job.origin === "jpeg" ? job.origin : null,
    rawIssue: new Set(["missing", "corrupt", "unsupported"]).has(String(job.rawIssue))
      ? job.rawIssue as EditingJob["rawIssue"]
      : null,
    jpegFallbackDecision: new Set(["not-needed", "pending", "authorized", "rejected"]).has(String(job.jpegFallbackDecision))
      ? job.jpegFallbackDecision as EditingJob["jpegFallbackDecision"]
      : "not-needed",
    profile,
    adobeResources: isRecord(job.adobeResources) ? job.adobeResources as EditingJob["adobeResources"] : smartStudioAdobeResources(),
    adjustments,
    uncontrolledConditionsWarning: typeof job.uncontrolledConditionsWarning === "string" ? job.uncontrolledConditionsWarning : null,
    lensCorrectionApplied: job.lensCorrectionApplied === true,
    versions,
    currentVersionId: typeof job.currentVersionId === "string" ? job.currentVersionId : versions.at(-1)?.id ?? null,
    approvedVersionId: typeof job.approvedVersionId === "string" ? job.approvedVersionId : versions.find((version) => version.approvalStatus === "approved")?.id ?? null,
    faceCount: typeof job.faceCount === "number" ? job.faceCount : 0,
    portraitWarnings: Array.isArray(job.portraitWarnings) ? job.portraitWarnings.filter((item): item is string => typeof item === "string") : [],
    backdropCompletion: isBackdropCompletion(job.backdropCompletion) ? job.backdropCompletion : "unchanged",
    backdropDiagnostics: isRecord(job.backdropDiagnostics) ? job.backdropDiagnostics as EditingJob["backdropDiagnostics"] : null,
    adaptiveTone: isRecord(job.adaptiveTone) ? job.adaptiveTone as EditingJob["adaptiveTone"] : null,
    eyeEnhancementEnabled: job.eyeEnhancementEnabled === true,
    teethWhiteningEnabled: job.teethWhiteningEnabled === true,
    metrics,
    accelerationWarning: typeof job.accelerationWarning === "string" ? job.accelerationWarning : "Ruta CPU activa; la edición sigue disponible con menor rendimiento.",
    manualCorrection: isRecord(job.manualCorrection) && typeof job.manualCorrection.sourceVersionId === "string" && typeof job.manualCorrection.psdRelativePath === "string"
      ? {
          ...(job.manualCorrection as NonNullable<EditingJob["manualCorrection"]>),
          backupStatus: new Set(["pending", "verified", "failed"]).has(String(job.manualCorrection.backupStatus))
            ? job.manualCorrection.backupStatus as "pending" | "verified" | "failed"
            : "pending",
          backupError: typeof job.manualCorrection.backupError === "string" ? job.manualCorrection.backupError : null,
        }
      : null,
  })})
}

const migrateState = (persisted: unknown): WorkflowState => {
  if (!isRecord(persisted)) return emptyWorkflowState()
  if ((persisted.version === 3 || persisted.version === 4 || persisted.version === 5 || persisted.version === 6 || persisted.version === 7 || persisted.version === 8 || persisted.version === 9 || persisted.version === 10 || persisted.version === 11 || persisted.version === 12 || persisted.version === 13 || persisted.version === 14 || persisted.version === 15 || persisted.version === 16 || persisted.version === 17) && Array.isArray(persisted.events)) {
    return {
      version: 17,
      events: persisted.events.filter(isRecord).map(upgradeEvent),
      editingJobs: upgradeEditingJobs(persisted.editingJobs),
      activeEventId: typeof persisted.activeEventId === "string" ? persisted.activeEventId : null,
      savedAt: typeof persisted.savedAt === "string" ? persisted.savedAt : null,
    }
  }
  if (persisted.version === 2 && Array.isArray(persisted.events)) {
    return {
      version: 17,
      events: persisted.events.filter(isRecord).map(upgradeEvent),
      editingJobs: [],
      activeEventId: typeof persisted.activeEventId === "string" ? persisted.activeEventId : null,
      savedAt: typeof persisted.savedAt === "string" ? persisted.savedAt : null,
    }
  }
  if (persisted.version === 1 && isRecord(persisted.event)) {
    const legacyEvent = persisted.event
    const legacySession = isRecord(legacyEvent.session) ? legacyEvent.session : null
    return {
      version: 17,
      activeEventId: String(legacyEvent.id),
      savedAt: typeof persisted.savedAt === "string" ? persisted.savedAt : null,
      editingJobs: [],
      events: [
        upgradeEvent({
          id: String(legacyEvent.id),
          name: String(legacyEvent.name),
          location: null,
          notes: null,
          createdAt: String(legacyEvent.createdAt),
          closedAt: null,
          status: "active",
          sessions: legacySession
            ? [{
                ...legacySession,
                label: null,
                completedAt: null,
                cancelledAt: null,
                status: "active",
              }]
            : [],
        }),
      ],
    }
  }
  return emptyWorkflowState()
}

export class WorkflowStore {
  private state: WorkflowState = emptyWorkflowState()
  private pendingWrite: Promise<void> = Promise.resolve()
  private readonly persistedListeners = new Set<() => void>()

  constructor(private readonly dataDirectory: string) {}

  async initialize(): Promise<void> {
    await mkdir(this.dataDirectory, { recursive: true })
    try {
      const contents = await readFile(this.statePath, "utf8")
      const persisted = JSON.parse(contents) as unknown
      this.state = migrateState(persisted)
      if (!isRecord(persisted) || persisted.version !== 17) await this.persist(this.state)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
    }
  }

  snapshot(): WorkflowState {
    return structuredClone(this.state)
  }

  onPersisted(listener: () => void): void {
    this.persistedListeners.add(listener)
  }

  async mutate(change: (state: WorkflowState) => void): Promise<WorkflowState> {
    change(this.state)
    this.state.savedAt = new Date().toISOString()
    const snapshot = this.snapshot()
    this.pendingWrite = this.pendingWrite.then(() => this.persist(snapshot))
    await this.pendingWrite
    for (const listener of this.persistedListeners) listener()
    return snapshot
  }

  private get statePath(): string {
    return path.join(this.dataDirectory, "workflow-state.json")
  }

  private async persist(state: WorkflowState): Promise<void> {
    const temporaryPath = `${this.statePath}.tmp`
    await writeFile(temporaryPath, `${JSON.stringify(state, null, 2)}\n`, "utf8")
    await rename(temporaryPath, this.statePath)
  }
}
