export type QualityWarning =
  | "blur"
  | "motion"
  | "eyes-closed"
  | "poor-framing"
  | "exposure"
  | "incomplete-file"

export type QualityAssessment = {
  score: number
  warnings: QualityWarning[]
  analyzedAt: string
  method: "local-heuristic" | "controlled-fixture"
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
}

export type WorkflowState = {
  version: 4
  events: Event[]
  activeEventId: string | null
  savedAt: string | null
}

export const emptyWorkflowState = (): WorkflowState => ({
  version: 4,
  events: [],
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
