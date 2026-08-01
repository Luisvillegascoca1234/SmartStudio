import { access, readFile, readdir, stat, writeFile, rename } from "node:fs/promises"
import path from "node:path"

import { classifyCaptureFile } from "./capture-ingestion.js"
import type { SonyImportResult } from "./capture-service.js"

const SCAN_INTERVAL_MILLISECONDS = 500
const STABLE_SCANS_REQUIRED = 2

type PersistedSource = { directory: string | null }
type Candidate = { signature: string; stableScans: number }

export type SonySourceSnapshot = {
  status: "ready" | "unavailable"
  label: string
  directory: string | null
  error: string | null
  configured: boolean
}

export class SonyFolderReceiver {
  private directory: string | null = null
  private status: SonySourceSnapshot["status"] = "unavailable"
  private error: string | null = null
  private readonly processed = new Set<string>()
  private readonly candidates = new Map<string, Candidate>()
  private scanQueue: Promise<void> = Promise.resolve()
  private timer: NodeJS.Timeout | null = null

  constructor(
    private readonly dataDirectory: string,
    private readonly receive: (file: { filepath: string; filename: string }) => Promise<SonyImportResult>,
  ) {}

  async initialize(): Promise<void> {
    try {
      const persisted = JSON.parse(await readFile(this.statePath, "utf8")) as PersistedSource
      if (typeof persisted.directory === "string") {
        this.directory = path.resolve(persisted.directory)
        try {
          await this.connect(persisted.directory, false)
        } catch {
          this.status = "unavailable"
          this.error = "La carpeta de recepción Sony configurada no está disponible."
        }
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        this.error = "No se pudo recuperar la carpeta de recepción Sony."
      }
    }
    this.timer = setInterval(() => this.scheduleScan(), SCAN_INTERVAL_MILLISECONDS)
    this.timer.unref()
  }

  async configure(directory: string): Promise<SonySourceSnapshot> {
    await this.connect(directory, true)
    return this.snapshot()
  }

  snapshot(): SonySourceSnapshot {
    return {
      status: this.status,
      label: this.status === "ready"
        ? "Carpeta de Imaging Edge disponible; conexión USB sin confirmar"
        : this.directory
          ? "Carpeta de Imaging Edge no disponible; usa importación manual"
          : "Sony/Imaging Edge sin configurar; importación manual disponible",
      directory: this.directory,
      error: this.error,
      configured: this.directory !== null,
    }
  }

  async close(): Promise<void> {
    if (this.timer) clearInterval(this.timer)
    await this.scanQueue
  }

  private async connect(directory: string, persist: boolean): Promise<void> {
    if (!path.isAbsolute(directory)) throw new Error("La ruta de recepción Sony debe ser absoluta.")
    const details = await stat(directory)
    if (!details.isDirectory()) throw new Error("La ruta de recepción Sony debe ser una carpeta existente.")
    await access(directory)
    this.directory = path.resolve(directory)
    this.status = "ready"
    this.error = null
    this.processed.clear()
    this.candidates.clear()
    for (const entry of await readdir(this.directory, { withFileTypes: true })) {
      if (entry.isFile()) this.processed.add(entry.name.toLocaleLowerCase())
    }
    if (persist) await this.persist()
  }

  private scheduleScan(): void {
    this.scanQueue = this.scanQueue.then(() => this.scan()).catch(() => undefined)
  }

  private async scan(): Promise<void> {
    if (!this.directory) return
    try {
      await access(this.directory)
      const entries = await readdir(this.directory, { withFileTypes: true })
      this.status = "ready"
      this.error = null
      for (const entry of entries) {
        const key = entry.name.toLocaleLowerCase()
        if (!entry.isFile() || this.processed.has(key) || !classifyCaptureFile(entry.name)) continue
        const filePath = path.join(this.directory, entry.name)
        const details = await stat(filePath)
        const signature = `${details.size}:${details.mtimeMs}`
        const previous = this.candidates.get(key)
        const stableScans = previous?.signature === signature ? previous.stableScans + 1 : 1
        this.candidates.set(key, { signature, stableScans })
        if (stableScans < STABLE_SCANS_REQUIRED) continue
        try {
          const result = await this.receive({ filepath: filePath, filename: entry.name })
          if (result === "waiting-for-series") {
            this.error = "Llegó una captura sin una serie abierta; permanece en la carpeta de Imaging Edge."
            continue
          }
          this.processed.add(key)
          this.candidates.delete(key)
        } catch (error) {
          const message = error instanceof Error ? error.message : "No se pudo incorporar una captura Sony."
          this.error = message
          this.processed.add(key)
        }
      }
    } catch {
      this.status = "unavailable"
      this.error = "Se perdió la carpeta de recepción Sony. La importación manual sigue disponible."
    }
  }

  private get statePath(): string {
    return path.join(this.dataDirectory, "sony-source-state.json")
  }

  private async persist(): Promise<void> {
    const temporaryPath = `${this.statePath}.tmp`
    await writeFile(temporaryPath, `${JSON.stringify({ directory: this.directory }, null, 2)}\n`, "utf8")
    await rename(temporaryPath, this.statePath)
  }
}
