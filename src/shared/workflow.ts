export type QualityWarning =
  | "blur"
  | "motion"
  | "eyes-closed"
  | "poor-framing"
  | "exposure"
  | "incomplete-file"

export const BACKDROP_COMPLETION_VALUES = ["completed", "unchanged", "omitted"] as const
export type BackdropCompletion = typeof BACKDROP_COMPLETION_VALUES[number]
export const BACKDROP_COMPLETION_LABELS: Record<BackdropCompletion, string> = {
  completed: "completado",
  unchanged: "sin cambios",
  omitted: "omitido",
}
export const isBackdropCompletion = (value: unknown): value is BackdropCompletion =>
  BACKDROP_COMPLETION_VALUES.includes(value as BackdropCompletion)

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
}

export type EditingAdjustments = {
  exposure: number
  temperature: number
  colorIntensity: number
  skinSmoothing: number
}

export type EditingProfile = {
  id: "natural-event"
  name: "Natural de evento"
  version: number
  defaults: EditingAdjustments
}

export const naturalEventProfile = (version = 1): EditingProfile => ({
  id: "natural-event",
  name: "Natural de evento",
  version,
  defaults: { exposure: 0, temperature: 0, colorIntensity: 0, skinSmoothing: 1 },
})

export type EditingJobStatus =
  | "queued"
  | "processing"
  | "awaiting-jpeg-authorization"
  | "jpeg-rejected"
  | "review"
  | "approved"
  | "failed"
  | "interrupted"
  | "cancelled"

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
  eyeEnhancementEnabled: boolean
  teethWhiteningEnabled: boolean
  metrics: {
    processingRoute: "cpu" | "gpu"
    previewMilliseconds: number | null
    deliveryMilliseconds: number | null
    failures: number
    retries: number
  }
  accelerationWarning: string | null
}

export type EditingVersion = {
  id: string
  number: number
  createdAt: string
  profile: EditingProfile
  adjustments: EditingAdjustments
  origin: "raw" | "jpeg"
  previewRelativePath: string
  approvalStatus: "review" | "approved" | "revoked" | "superseded"
  approvedAt: string | null
  revokedAt: string | null
  fullRelativePath: string | null
  deliveryStatus: "not-requested" | "generating" | "ready" | "failed"
  deliveryError: string | null
  width: number | null
  height: number | null
  backupStatus: "pending" | "verified" | "failed"
  backupError: string | null
}

export type WorkflowState = {
  version: 10
  events: Event[]
  editingJobs: EditingJob[]
  activeEventId: string | null
  savedAt: string | null
}

export const emptyWorkflowState = (): WorkflowState => ({
  version: 10,
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
