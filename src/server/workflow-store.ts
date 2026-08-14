import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import path from "node:path"

import {
  emptyWorkflowState,
  emptyRetouchStageMilliseconds,
  isBackdropCompletion,
  omittedRetouchDecisions,
  type Capture,
  type EditingJob,
  type Event,
  type Series,
  type WorkflowState,
  naturalEventProfile,
  polishedEventProfile,
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
  editingProfile: isRecord(event.editingProfile) && event.editingProfile.id === "polished-event"
    ? event.editingProfile as Event["editingProfile"]
    : polishedEventProfile(),
  cleanPlates: Array.isArray(event.cleanPlates)
    ? event.cleanPlates.filter(isRecord).filter((plate) =>
        typeof plate.id === "string" &&
        typeof plate.relativePath === "string" &&
        typeof plate.sha256 === "string" &&
        typeof plate.width === "number" &&
        typeof plate.height === "number",
      ).map((plate) => ({
        id: plate.id as string,
        relativePath: plate.relativePath as string,
        sha256: plate.sha256 as string,
        width: plate.width as number,
        height: plate.height as number,
        orientation: typeof plate.orientation === "number" ? plate.orientation : 1,
        createdAt: typeof plate.createdAt === "string" ? plate.createdAt : new Date(0).toISOString(),
        validatedAt: typeof plate.validatedAt === "string" ? plate.validatedAt : new Date(0).toISOString(),
        validationMethod: plate.validationMethod === "local-mediapipe" ? "local-mediapipe" : "controlled-fixture",
        supersedesId: typeof plate.supersedesId === "string" ? plate.supersedesId : null,
      }))
    : [],
  activeCleanPlateId: typeof event.activeCleanPlateId === "string" ? event.activeCleanPlateId : null,
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
    const legacyPreview = typeof job.previewRelativePath === "string" ? job.previewRelativePath : null
    const versions: EditingJob["versions"] = Array.isArray(job.versions)
      ? job.versions.filter(isRecord).map((version) => ({
          ...version,
          previewSha256: typeof version.previewSha256 === "string" ? version.previewSha256 : null,
          previewMasterSha256: typeof version.previewMasterSha256 === "string" ? version.previewMasterSha256 : null,
          masterId: typeof version.masterId === "string" ? version.masterId : null,
          masterRelativePath: typeof version.masterRelativePath === "string" ? version.masterRelativePath : null,
          masterSha256: typeof version.masterSha256 === "string" ? version.masterSha256 : null,
          originalSha256: typeof version.originalSha256 === "string" ? version.originalSha256 : null,
          recipeRelativePath: typeof version.recipeRelativePath === "string" ? version.recipeRelativePath : null,
          recipeVersion: typeof version.recipeVersion === "number" ? version.recipeVersion : null,
          recipeSha256: typeof version.recipeSha256 === "string" ? version.recipeSha256 : null,
          developer: new Set(["controlled", "darktable", "rawpy", "jpeg"]).has(String(version.developer)) ? version.developer : null,
          developerVersion: typeof version.developerVersion === "string" ? version.developerVersion : null,
          developerParameters: isRecord(version.developerParameters) ? version.developerParameters as EditingJob["versions"][number]["developerParameters"] : {},
          developmentWarnings: Array.isArray(version.developmentWarnings) ? version.developmentWarnings.filter((item): item is string => typeof item === "string") : [],
          iccProfile: typeof version.iccProfile === "string" ? version.iccProfile : null,
          backupStatus: new Set(["pending", "verified", "failed"]).has(String(version.backupStatus)) ? version.backupStatus : "pending",
          backupError: typeof version.backupError === "string" ? version.backupError : null,
          backdropCompletion: isBackdropCompletion(version.backdropCompletion) ? version.backdropCompletion : "unchanged",
          matte: isRecord(version.matte) ? version.matte as EditingJob["matte"] : null,
          matteConfiguration: isRecord(version.matteConfiguration) ? version.matteConfiguration as EditingJob["matteConfiguration"] : null,
          backdropReason: typeof version.backdropReason === "string" ? version.backdropReason : null,
          portraitWarnings: Array.isArray(version.portraitWarnings) ? version.portraitWarnings.filter((item): item is string => typeof item === "string") : [],
          stageMilliseconds: isRecord(version.stageMilliseconds) ? version.stageMilliseconds as EditingJob["metrics"]["stages"] : emptyRetouchStageMilliseconds(),
          cleanPlateId: typeof version.cleanPlateId === "string" ? version.cleanPlateId : null,
          cleanPlateRelativePath: typeof version.cleanPlateRelativePath === "string" ? version.cleanPlateRelativePath : null,
          cleanPlateSha256: typeof version.cleanPlateSha256 === "string" ? version.cleanPlateSha256 : null,
        } as EditingJob["versions"][number]))
      : legacyPreview
        ? [{
            id: crypto.randomUUID(), number: 1, createdAt: typeof job.previewReadyAt === "string" ? job.previewReadyAt : new Date(0).toISOString(),
            profile, adjustments, origin: job.origin === "jpeg" ? "jpeg" : "raw", previewRelativePath: legacyPreview,
            previewSha256: null, previewMasterSha256: null, masterId: null, masterRelativePath: null, masterSha256: null,
            originalSha256: null, recipeRelativePath: null, recipeVersion: null, recipeSha256: null,
            developer: null, developerVersion: null, developerParameters: {}, developmentWarnings: [], iccProfile: null,
            approvalStatus: job.status === "approved" ? "approved" : "review", approvedAt: typeof job.approvedAt === "string" ? job.approvedAt : null,
            revokedAt: null, fullRelativePath: null, deliveryStatus: "not-requested", deliveryError: null, width: null, height: null,
            backupStatus: "pending", backupError: null,
            backdropCompletion: "unchanged", matte: null, matteConfiguration: null, backdropReason: null, portraitWarnings: [], stageMilliseconds: emptyRetouchStageMilliseconds(), cleanPlateId: null, cleanPlateRelativePath: null, cleanPlateSha256: null,
          } as EditingJob["versions"][number]]
        : []
    return ({
    id: job.id as string,
    eventId: job.eventId as string,
    sessionId: job.sessionId as string,
    captureId: job.captureId as string,
    status: new Set(["queued", "processing", "awaiting-jpeg-authorization", "jpeg-rejected", "review", "approved", "rejected", "failed", "interrupted", "cancelled"]).has(String(job.status))
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
    origin: job.origin === "raw" || job.origin === "jpeg" ? job.origin : null,
    rawIssue: new Set(["missing", "corrupt", "unsupported"]).has(String(job.rawIssue))
      ? job.rawIssue as EditingJob["rawIssue"]
      : null,
    jpegFallbackDecision: new Set(["not-needed", "pending", "authorized", "rejected"]).has(String(job.jpegFallbackDecision))
      ? job.jpegFallbackDecision as EditingJob["jpegFallbackDecision"]
      : "not-needed",
    profile,
    adjustments,
    uncontrolledConditionsWarning: typeof job.uncontrolledConditionsWarning === "string" ? job.uncontrolledConditionsWarning : null,
    lensCorrectionApplied: job.lensCorrectionApplied === true,
    versions,
    currentVersionId: typeof job.currentVersionId === "string" ? job.currentVersionId : versions.at(-1)?.id ?? null,
    approvedVersionId: typeof job.approvedVersionId === "string" ? job.approvedVersionId : versions.find((version) => version.approvalStatus === "approved")?.id ?? null,
    faceCount: typeof job.faceCount === "number" ? job.faceCount : 0,
    portraitWarnings: Array.isArray(job.portraitWarnings) ? job.portraitWarnings.filter((item): item is string => typeof item === "string") : [],
    backdropCompletion: isBackdropCompletion(job.backdropCompletion) ? job.backdropCompletion : "unchanged",
    matte: isRecord(job.matte) && (job.matte.provider === "controlled" || job.matte.provider === "mediapipe" || job.matte.provider === "birefnet")
      ? job.matte as EditingJob["matte"]
      : null,
    matteConfiguration: isRecord(job.matteConfiguration) ? job.matteConfiguration as EditingJob["matteConfiguration"] : null,
    cleanPlateId: typeof job.cleanPlateId === "string" ? job.cleanPlateId : null,
    cleanPlateRelativePath: typeof job.cleanPlateRelativePath === "string" ? job.cleanPlateRelativePath : null,
    cleanPlateSha256: typeof job.cleanPlateSha256 === "string" ? job.cleanPlateSha256 : null,
    eyeEnhancementEnabled: job.eyeEnhancementEnabled !== false,
    teethWhiteningEnabled: job.teethWhiteningEnabled !== false,
    processDiagnostics: Array.isArray(job.processDiagnostics)
      ? job.processDiagnostics.filter(isRecord).filter((diagnostic) =>
          typeof diagnostic.stage === "string" &&
          typeof diagnostic.durationMilliseconds === "number" &&
          (typeof diagnostic.code === "number" || diagnostic.code === null) &&
          new Set(["completed", "failed", "timeout", "cancelled", "spawn-error"]).has(String(diagnostic.termination)),
        ) as EditingJob["processDiagnostics"]
      : [],
    retouchDecisions: isRecord(job.retouchDecisions) ? job.retouchDecisions as EditingJob["retouchDecisions"] : omittedRetouchDecisions(),
    metrics: {
      processingRoute: isRecord(job.metrics) && job.metrics.processingRoute === "gpu" ? "gpu" : "cpu",
      previewMilliseconds: isRecord(job.metrics) && typeof job.metrics.previewMilliseconds === "number" ? job.metrics.previewMilliseconds : null,
      deliveryMilliseconds: isRecord(job.metrics) && typeof job.metrics.deliveryMilliseconds === "number" ? job.metrics.deliveryMilliseconds : null,
      failures: isRecord(job.metrics) && typeof job.metrics.failures === "number" ? job.metrics.failures : 0,
      retries: isRecord(job.metrics) && typeof job.metrics.retries === "number" ? job.metrics.retries : 0,
      stages: isRecord(job.metrics) && isRecord(job.metrics.stages)
        ? { ...emptyRetouchStageMilliseconds(), development: 0, export: 0, ...job.metrics.stages }
        : { ...emptyRetouchStageMilliseconds(), development: 0, export: 0 },
    },
    accelerationWarning: typeof job.accelerationWarning === "string" ? job.accelerationWarning : "Ruta CPU activa; la edición sigue disponible con menor rendimiento.",
    accelerationEvidence: job.accelerationEvidence === "effective-opencl" || job.accelerationEvidence === "cpu" ? job.accelerationEvidence : "inconclusive",
  })})
}

const migrateState = (persisted: unknown): WorkflowState => {
  if (!isRecord(persisted)) return emptyWorkflowState()
  if ((persisted.version === 3 || persisted.version === 4 || persisted.version === 5 || persisted.version === 6 || persisted.version === 7 || persisted.version === 8 || persisted.version === 9 || persisted.version === 10 || persisted.version === 11 || persisted.version === 12 || persisted.version === 13 || persisted.version === 14 || persisted.version === 15) && Array.isArray(persisted.events)) {
    return {
      version: 15,
      events: persisted.events.filter(isRecord).map(upgradeEvent),
      editingJobs: upgradeEditingJobs(persisted.editingJobs),
      activeEventId: typeof persisted.activeEventId === "string" ? persisted.activeEventId : null,
      savedAt: typeof persisted.savedAt === "string" ? persisted.savedAt : null,
    }
  }
  if (persisted.version === 2 && Array.isArray(persisted.events)) {
    return {
      version: 15,
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
      version: 15,
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
      if (!isRecord(persisted) || persisted.version !== 15) await this.persist(this.state)
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
