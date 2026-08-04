import path from "node:path"
import {
  activeEvent,
  activeSeries,
  activeSession,
  type Capture,
  type PhotoSession,
  type QualityWarning,
  type Series,
  type WorkflowState,
} from "../shared/workflow.js"
import { incorporateOriginal } from "./capture-ingestion.js"
import { assessJpeg } from "./quality-analysis.js"
import { prepareSimulatedPair } from "./simulator.js"
import { WorkflowStore } from "./workflow-store.js"

type ImportedFile = { filepath: string; filename: string }
export type SonyImportResult = "imported" | "waiting-for-series"

export class CaptureService {
  constructor(
    private readonly store: WorkflowStore,
    private readonly dataDirectory: string,
  ) {}

  async simulatePair(): Promise<WorkflowState> {
    const simulation = await this.prepareNextSimulation()
    await this.incorporate(simulation.jpegPath, `${simulation.baseName}.JPG`, "simulated-folder")
    return this.incorporate(simulation.rawPath, `${simulation.baseName}.ARW`, "simulated-folder")
  }

  async simulateFirst(order: "jpeg-first" | "raw-first"): Promise<WorkflowState> {
    const simulation = await this.prepareNextSimulation()
    return order === "jpeg-first"
      ? this.incorporate(simulation.jpegPath, `${simulation.baseName}.JPG`, "simulated-folder")
      : this.incorporate(simulation.rawPath, `${simulation.baseName}.ARW`, "simulated-folder")
  }

  async simulateQualityFixtures(): Promise<WorkflowState> {
    const profiles: QualityWarning[] = ["blur", "motion", "eyes-closed", "poor-framing", "exposure"]
    let state = this.store.snapshot()
    for (const profile of profiles) {
      const simulation = await this.prepareNextSimulation(profile)
      await this.incorporate(simulation.jpegPath, `${simulation.baseName}.JPG`, "simulated-folder")
      state = await this.incorporate(simulation.rawPath, `${simulation.baseName}.ARW`, "simulated-folder")
    }
    const incomplete = await this.prepareNextSimulation()
    return this.incorporate(incomplete.jpegPath, `${incomplete.baseName}.JPG`, "simulated-folder")
  }

  async completeSimulatedCapture(id: string): Promise<WorkflowState> {
    const located = this.findActiveCapture(this.store.snapshot(), id)
    if (!located) throw new Error("La captura no existe en la sesión fotográfica activa.")
    const { capture, series } = located
    if (capture.source !== "simulated-folder") {
      throw new Error("Solo las capturas simuladas pueden completar un componente de forma sintética.")
    }
    const simulation = await prepareSimulatedPair({
      dataDirectory: this.dataDirectory,
      baseName: capture.baseName,
      capturedAt: capture.capturedAt,
    })
    if (!capture.jpegRelativePath) {
      await this.incorporate(simulation.jpegPath, `${capture.baseName}.JPG`, "simulated-folder", series.id)
    }
    if (!capture.rawRelativePath) {
      return this.incorporate(simulation.rawPath, `${capture.baseName}.ARW`, "simulated-folder", series.id)
    }
    return this.store.snapshot()
  }

  async importFiles(files: ImportedFile[]): Promise<WorkflowState> {
    if (files.length === 0) return this.addWarning("La carpeta seleccionada no contenía archivos.")
    let state = this.store.snapshot()
    for (const file of files) {
      try {
        state = await this.incorporate(file.filepath, file.filename, "manual-folder")
      } catch (error) {
        const message = error instanceof Error ? error.message : `No se pudo importar ${file.filename}.`
        state = await this.addWarning(message)
      }
    }
    return state
  }

  async importSonyFile(file: ImportedFile): Promise<SonyImportResult> {
    const series = activeSeries(this.store.snapshot())
    if (!series || series.status !== "capturing") return "waiting-for-series"
    await this.incorporate(file.filepath, file.filename, "sony-usb-folder")
    return "imported"
  }

  async exclude(id: string): Promise<WorkflowState> {
    if (!this.findActiveCapture(this.store.snapshot(), id)) {
      throw new Error("La captura no existe en la sesión fotográfica activa.")
    }
    return this.store.mutate((state) => {
      const located = this.findActiveCapture(state, id)!
      const item = located.capture
      item.excluded = true
      item.selected = false
      item.principal = false
      if (located.series.status === "selected") located.series.status = "review"
      const currentSeries = activeSeries(state)
      if (currentSeries?.status === "selected") currentSeries.status = "review"
    })
  }

  async restore(id: string): Promise<WorkflowState> {
    const located = this.findActiveCapture(this.store.snapshot(), id)
    if (!located?.capture.excluded) {
      throw new Error("La captura excluida no existe en la sesión fotográfica activa.")
    }
    return this.store.mutate((state) => {
      this.findActiveCapture(state, id)!.capture.excluded = false
    })
  }

  async authorizeEmergencyJpeg(id: string): Promise<WorkflowState> {
    const located = this.findActiveCapture(this.store.snapshot(), id)
    if (!located || located.capture.status !== "raw-pending") {
      throw new Error("Solo una captura con RAW pendiente puede autorizar JPEG de emergencia.")
    }
    return this.store.mutate((state) => {
      this.findActiveCapture(state, id)!.capture.emergencyJpegAuthorized = true
    })
  }

  private async incorporate(
    sourcePath: string,
    sourceFileName: string,
    source: Capture["source"],
    targetSeriesId?: string,
  ): Promise<WorkflowState> {
    const current = this.store.snapshot()
    const event = activeEvent(current)
    const session = activeSession(current)
    const series = targetSeriesId
      ? session?.series.find((item) => item.id === targetSeriesId)
      : activeSeries(current)
    if (!event || !session || !series) throw new Error("Abre una serie antes de incorporar capturas.")
    const component = await incorporateOriginal({
      dataDirectory: this.dataDirectory,
      eventId: event.id,
      sessionId: session.id,
      sourcePath,
      sourceFileName,
    })
    const quality = component.kind === "jpeg"
      ? await assessJpeg(path.join(this.dataDirectory, component.relativePath))
      : null
    return this.store.mutate((state) => {
      const currentSession = activeSession(state)!
      const currentSeries = targetSeriesId
        ? currentSession.series.find((item) => item.id === targetSeriesId)!
        : activeSeries(state)!
      let capture = currentSeries.captures.find(
        (item) => item.baseName.toLocaleLowerCase() === component.baseName.toLocaleLowerCase(),
      )
      if (!capture) {
        capture = {
          id: crypto.randomUUID(),
          baseName: component.baseName,
          rawRelativePath: null,
          jpegRelativePath: null,
          rawSha256: null,
          jpegSha256: null,
          capturedAt: new Date().toISOString(),
          source,
          status: component.kind === "raw" ? "jpeg-pending" : "raw-pending",
          emergencyJpegAuthorized: false,
          excluded: false,
          quality: null,
          selected: false,
          principal: false,
        }
        currentSeries.captures.push(capture)
      }
      if (component.kind === "raw") {
        capture.rawRelativePath = component.relativePath
        capture.rawSha256 = component.sha256
      } else {
        capture.jpegRelativePath = component.relativePath
        capture.jpegSha256 = component.sha256
        capture.quality = quality
      }
      capture.status = capture.rawRelativePath && capture.jpegRelativePath
        ? "complete"
        : capture.rawRelativePath
          ? "jpeg-pending"
          : "raw-pending"
    })
  }

  private async addWarning(message: string): Promise<WorkflowState> {
    return this.store.mutate((state) => {
      const series = activeSeries(state)
      if (!series) throw new Error("Abre una serie antes de importar archivos.")
      series.warnings.push(message)
    })
  }

  private async prepareNextSimulation(profile?: QualityWarning) {
    const current = this.store.snapshot()
    const session = activeSession(current)
    const series = activeSeries(current)
    if (!activeEvent(current) || !session || !series || series.status !== "capturing") {
      throw new Error("Abre una serie antes de simular una captura.")
    }
    const captureNumber = series.captures.length + 1
    const baseName = `SIM_S${String(session.number).padStart(2, "0")}_R${String(series.number).padStart(2, "0")}_${String(captureNumber).padStart(3, "0")}`
    const capturedAt = new Date().toISOString()
    const paths = await prepareSimulatedPair({ dataDirectory: this.dataDirectory, baseName, capturedAt, profile })
    return { ...paths, baseName }
  }

  private findActiveCapture(
    state: WorkflowState,
    id: string,
  ): { session: PhotoSession; series: Series; capture: Capture } | null {
    const session = activeSession(state)
    if (!session) return null
    for (const series of session.series) {
      const capture = series.captures.find((item) => item.id === id)
      if (capture) return { session, series, capture }
    }
    return null
  }
}
