export type QualityWarning =
  | "blur"
  | "motion"
  | "eyes-closed"
  | "poor-framing"
  | "exposure"
  | "incomplete-file"

export const BACKDROP_COMPLETION_VALUES = ["replaced", "completed", "unchanged", "omitted"] as const
export type BackdropCompletion = typeof BACKDROP_COMPLETION_VALUES[number]
export const BACKDROP_COMPLETION_LABELS: Record<BackdropCompletion, string> = {
  replaced: "reemplazado",
  completed: "completado",
  unchanged: "sin cambios",
  omitted: "omitido",
}
export const isBackdropCompletion = (value: unknown): value is BackdropCompletion =>
  BACKDROP_COMPLETION_VALUES.includes(value as BackdropCompletion)

export type MatteProvenance = {
  provider: "controlled" | "mediapipe" | "birefnet"
  model: string
  modelVersion: string
  modelSha256: string | null
  confidence: number
  boundaryConfidence: number
  uncertainFraction: number
  processingRoute: "cpu" | "gpu"
  sessionReused: boolean
  warmupMilliseconds: number
}

export type MatteConfiguration = {
  provider: "mediapipe" | "birefnet"
  model: string
  modelVersion: string
  modelSha256: string
  parametersVersion: "background-matte-v1"
}

export const automaticMatteConfiguration = (provider?: string): MatteConfiguration =>
  provider === "birefnet"
    ? {
        provider: "birefnet",
        model: "birefnet-general-lite.onnx",
        modelVersion: "general-lite-epoch-232",
        modelSha256: "5600024376f572a557870a5eb0afb1e5961636bef4e1e22132025467d0f03333",
        parametersVersion: "background-matte-v1",
      }
    : {
        provider: "mediapipe",
        model: "selfie_multiclass_256x256.tflite",
        modelVersion: "1",
        modelSha256: "c6748b1253a99067ef71f7e26ca71096cd449baefa8f101900ea23016507e0e0",
        parametersVersion: "background-matte-v1",
      }

export type QualityAssessment = {
  score: number
  warnings: QualityWarning[]
  analyzedAt: string
  method: "local-heuristic" | "local-mediapipe" | "controlled-fixture"
}

export type Capture = {
  id: string
  baseName: string
  rawRelativePath: string | null
  jpegRelativePath: string | null
  rawSha256: string | null
  jpegSha256: string | null
  capturedAt: string
  source: "simulated-folder" | "manual-folder" | "sony-usb-folder"
  status: "complete" | "raw-pending" | "jpeg-pending"
  emergencyJpegAuthorized: boolean
  excluded: boolean
  quality: QualityAssessment | null
  selected: boolean
  principal: boolean
}

export type Series = {
  id: string
  number: number
  startedAt: string
  closedAt: string | null
  status: "capturing" | "review" | "selected"
  captures: Capture[]
  warnings: string[]
}

export type PhotoSession = {
  id: string
  number: number
  label: string | null
  startedAt: string
  completedAt: string | null
  cancelledAt: string | null
  status: "active" | "completed" | "cancelled"
  series: Series[]
}

export type CleanPlateReference = {
  id: string
  relativePath: string
  sha256: string
  width: number
  height: number
  orientation: number
  createdAt: string
  validatedAt: string
  validationMethod: "local-mediapipe" | "controlled-fixture"
  supersedesId: string | null
}

export type Event = {
  id: string
  name: string
  location: string | null
  notes: string | null
  createdAt: string
  closedAt: string | null
  status: "active" | "closed"
  sessions: PhotoSession[]
  editingProfile: EditingProfile
  cleanPlates: CleanPlateReference[]
  activeCleanPlateId: string | null
}

export type EditingAdjustments = {
  exposure: number
  temperature: number
  colorIntensity: number
  skinSmoothing: number
}

export type EditingProfile =
  | {
      id: "natural-event"
      name: "Natural de evento"
      version: number
      defaults: EditingAdjustments
    }
  | {
      id: "polished-event"
      name: "Evento pulido"
      version: number
      defaults: EditingAdjustments
    }

export const naturalEventProfile = (version = 1): EditingProfile => ({
  id: "natural-event",
  name: "Natural de evento",
  version,
  defaults: { exposure: 0, temperature: 0, colorIntensity: 0, skinSmoothing: 1 },
})

export const polishedEventProfile = (version = 1): EditingProfile => ({
  id: "polished-event",
  name: "Evento pulido",
  version,
  defaults: { exposure: 0, temperature: 0, colorIntensity: 0, skinSmoothing: 2 },
})

export type EditingJobStatus =
  | "queued"
  | "processing"
  | "awaiting-jpeg-authorization"
  | "jpeg-rejected"
  | "review"
  | "approved"
  | "rejected"
  | "failed"
  | "interrupted"
  | "cancelled"

export const editingJobHasEditorialDecision = (status: EditingJobStatus): boolean => status === "approved" || status === "rejected"

export const editingJobIsTerminal = (status: EditingJobStatus): boolean => editingJobHasEditorialDecision(status) || status === "cancelled"

export type ProcessDiagnostic = {
  stage: string
  durationMilliseconds: number
  code: number | null
  termination: "completed" | "failed" | "timeout" | "cancelled" | "spawn-error"
  outputTruncated: boolean
}

export type RetouchOperation = "skin" | "eyes" | "teeth" | "facialLighting" | "backdrop"
export type RetouchOperationDecision = {
  status: "applied" | "omitted"
  reason: string | null
  regions: number
  omittedRegions: number
}
export type RetouchStageMilliseconds = {
  analysis: number
  skin: number
  eyesTeeth: number
  facialLighting: number
  backdrop: number
}

export const omittedRetouchDecisions = (): Record<RetouchOperation, RetouchOperationDecision> => ({
  skin: { status: "omitted", reason: "Todavía no se analizó la piel.", regions: 0, omittedRegions: 0 },
  eyes: { status: "omitted", reason: "Todavía no se analizaron los ojos.", regions: 0, omittedRegions: 0 },
  teeth: { status: "omitted", reason: "Todavía no se analizaron los dientes.", regions: 0, omittedRegions: 0 },
  facialLighting: { status: "omitted", reason: "Todavía no se analizó la luz facial.", regions: 0, omittedRegions: 0 },
  backdrop: { status: "omitted", reason: "Todavía no se analizó el fondo.", regions: 0, omittedRegions: 0 },
})

export const emptyRetouchStageMilliseconds = (): RetouchStageMilliseconds => ({ analysis: 0, skin: 0, eyesTeeth: 0, facialLighting: 0, backdrop: 0 })

export type EditingJob = {
  id: string
  eventId: string
  sessionId: string
  captureId: string
  status: EditingJobStatus
  createdAt: string
  startedAt: string | null
  finishedAt: string | null
  previewReadyAt: string | null
  approvedAt: string | null
  previewRelativePath: string | null
  error: string | null
  attempts: number
  origin: "raw" | "jpeg" | null
  rawIssue: "missing" | "corrupt" | "unsupported" | null
  jpegFallbackDecision: "not-needed" | "pending" | "authorized" | "rejected"
  profile: EditingProfile
  adjustments: EditingAdjustments
  uncontrolledConditionsWarning: string | null
  lensCorrectionApplied: boolean
  versions: EditingVersion[]
  currentVersionId: string | null
  approvedVersionId: string | null
  faceCount: number
  portraitWarnings: string[]
  backdropCompletion: BackdropCompletion
  matte: MatteProvenance | null
  matteConfiguration: MatteConfiguration | null
  cleanPlateId: string | null
  cleanPlateRelativePath: string | null
  cleanPlateSha256: string | null
  eyeEnhancementEnabled: boolean
  teethWhiteningEnabled: boolean
  processDiagnostics: ProcessDiagnostic[]
  retouchDecisions: Record<RetouchOperation, RetouchOperationDecision>
  metrics: {
    processingRoute: "cpu" | "gpu"
    previewMilliseconds: number | null
    deliveryMilliseconds: number | null
    failures: number
    retries: number
    stages: RetouchStageMilliseconds & { development: number; export: number }
  }
  accelerationWarning: string | null
  accelerationEvidence: "effective-opencl" | "cpu" | "inconclusive"
}

export type EditingVersion = {
  id: string
  number: number
  createdAt: string
  profile: EditingProfile
  adjustments: EditingAdjustments
  origin: "raw" | "jpeg"
  previewRelativePath: string
  previewSha256: string | null
  previewMasterSha256: string | null
  masterId: string | null
  masterRelativePath: string | null
  masterSha256: string | null
  originalSha256: string | null
  recipeRelativePath: string | null
  recipeVersion: number | null
  recipeSha256: string | null
  developer: "controlled" | "darktable" | "rawpy" | "jpeg" | null
  developerVersion: string | null
  developerParameters: Record<string, string | number | boolean>
  developmentWarnings: string[]
  iccProfile: string | null
  approvalStatus: "review" | "approved" | "rejected" | "revoked" | "superseded"
  approvedAt: string | null
  revokedAt: string | null
  fullRelativePath: string | null
  deliveryStatus: "not-requested" | "generating" | "ready" | "failed"
  deliveryError: string | null
  width: number | null
  height: number | null
  backupStatus: "pending" | "verified" | "failed"
  backupError: string | null
  backdropCompletion: BackdropCompletion
  matte: MatteProvenance | null
  matteConfiguration: MatteConfiguration | null
  backdropReason: string | null
  portraitWarnings: string[]
  stageMilliseconds: RetouchStageMilliseconds
  cleanPlateId: string | null
  cleanPlateRelativePath: string | null
  cleanPlateSha256: string | null
}

export type WorkflowState = {
  version: 15
  events: Event[]
  editingJobs: EditingJob[]
  activeEventId: string | null
  savedAt: string | null
}

export const emptyWorkflowState = (): WorkflowState => ({
  version: 15,
  events: [],
  editingJobs: [],
  activeEventId: null,
  savedAt: null,
})

export const activeEvent = (state: WorkflowState): Event | null =>
  state.events.find((event) => event.id === state.activeEventId) ?? null

export const activeSession = (state: WorkflowState): PhotoSession | null =>
  activeEvent(state)?.sessions.find((session) => session.status === "active") ?? null

export const activeSeries = (state: WorkflowState): Series | null =>
  activeSession(state)?.series.at(-1) ?? null

export const sessionCaptures = (session: PhotoSession): Capture[] =>
  session.series.flatMap((series) => series.captures)

export const sessionIsReadyForEditing = (session: PhotoSession): boolean => {
  const selected = sessionCaptures(session).filter((capture) => capture.selected)
  return selected.length >= 1 && selected.length <= 3 && selected.filter((capture) => capture.principal).length === 1
}

export const editingJobsForEvent = (state: WorkflowState, eventId: string): EditingJob[] =>
  state.editingJobs.filter((job) => job.eventId === eventId)

export const captureById = (state: WorkflowState, id: string): Capture | null => {
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
