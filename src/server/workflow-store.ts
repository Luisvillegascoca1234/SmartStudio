import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import path from "node:path"

import {
  emptyWorkflowState,
  type Capture,
  type Event,
  type Series,
  type WorkflowState,
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
})

const migrateState = (persisted: unknown): WorkflowState => {
  if (!isRecord(persisted)) return emptyWorkflowState()
  if ((persisted.version === 3 || persisted.version === 4) && Array.isArray(persisted.events)) {
    return {
      ...(persisted as WorkflowState),
      version: 4,
      events: persisted.events.filter(isRecord).map(upgradeEvent),
    }
  }
  if (persisted.version === 2 && Array.isArray(persisted.events)) {
    return {
      version: 4,
      events: persisted.events.filter(isRecord).map(upgradeEvent),
      activeEventId: typeof persisted.activeEventId === "string" ? persisted.activeEventId : null,
      savedAt: typeof persisted.savedAt === "string" ? persisted.savedAt : null,
    }
  }
  if (persisted.version === 1 && isRecord(persisted.event)) {
    const legacyEvent = persisted.event
    const legacySession = isRecord(legacyEvent.session) ? legacyEvent.session : null
    return {
      version: 4,
      activeEventId: String(legacyEvent.id),
      savedAt: typeof persisted.savedAt === "string" ? persisted.savedAt : null,
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
      if (!isRecord(persisted) || persisted.version !== 4) await this.persist(this.state)
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
