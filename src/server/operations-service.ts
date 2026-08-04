import { execFile } from "node:child_process"
import { constants } from "node:fs"
import { access, copyFile, mkdir, readFile, readdir, rename, stat, statfs, writeFile } from "node:fs/promises"
import path from "node:path"
import { promisify } from "node:util"

import type { OperationsSnapshot } from "../shared/operations.js"
import { sha256File } from "./file-hash.js"

const GIBIBYTE = 1024 ** 3
const LOW_SPACE_BYTES = 100 * GIBIBYTE
const CRITICAL_SPACE_BYTES = 20 * GIBIBYTE
const BACKUP_FOLDER_NAME = "SmartStudioBackup"
const POWER_CACHE_MILLISECONDS = 30_000
const execFileAsync = promisify(execFile)

type PersistedOperations = {
  backupDirectory: string | null
  backupStatus: OperationsSnapshot["backup"]["status"]
  verifiedFiles: number
  lastVerifiedAt: string | null
  backupError: string | null
  soundAlertsEnabled: boolean
}

type TestConditions = {
  freeBytes?: number
  power?: OperationsSnapshot["power"]["status"]
  captureSource?: OperationsSnapshot["captureSource"]["status"]
  backupDisconnected?: boolean
  backupCopyFailure?: boolean
}

const initialState = (): PersistedOperations => ({
  backupDirectory: null,
  backupStatus: "not-configured",
  verifiedFiles: 0,
  lastVerifiedAt: null,
  backupError: null,
  soundAlertsEnabled: true,
})

export class OperationsService {
  private state = initialState()
  private testConditions: TestConditions = {}
  private backupQueue: Promise<void> = Promise.resolve()
  private powerCache: { status: OperationsSnapshot["power"]["status"]; expiresAt: number } | null = null
  private captureSourceProvider: () => { status: "ready" | "unavailable"; label: string; configured: boolean } = () => ({
    status: "unavailable",
    label: "Sony/Imaging Edge sin configurar; importación manual disponible",
    configured: false,
  })

  constructor(
    private readonly dataDirectory: string,
    private readonly allowTestFeatures: boolean,
  ) {}

  async initialize(): Promise<void> {
    try {
      const contents = JSON.parse(await readFile(this.statePath, "utf8")) as Partial<PersistedOperations>
      this.state = { ...initialState(), ...contents }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
    }
  }

  async snapshot(): Promise<OperationsSnapshot> {
    const freeBytes = this.testConditions.freeBytes ?? await this.readFreeBytes()
    const level = freeBytes < CRITICAL_SPACE_BYTES ? "critical" : freeBytes < LOW_SPACE_BYTES ? "low" : "sufficient"
    const connected = await this.backupConnected()
    const backupStatus = this.state.backupDirectory && !connected ? "disconnected" : this.state.backupStatus
    const backupError = backupStatus === "disconnected"
      ? this.state.backupError ?? "El SSD configurado no está disponible."
      : this.state.backupError
    const power = this.testConditions.power ?? await this.readPowerStatus()
    const detectedSource = this.captureSourceProvider()
    const source = this.testConditions.captureSource ?? detectedSource.status
    return {
      captureSource: {
        status: source,
        label: this.testConditions.captureSource
          ? source === "ready" ? "Fuente controlada disponible" : "Fuente de captura no disponible"
          : detectedSource.label,
        configured: this.testConditions.captureSource !== undefined || detectedSource.configured,
        cameraCardRequired: true,
      },
      internalStorage: { level, freeBytes },
      backup: {
        directory: this.state.backupDirectory,
        connected,
        status: backupStatus,
        verifiedFiles: this.state.verifiedFiles,
        lastVerifiedAt: this.state.lastVerifiedAt,
        error: backupError,
      },
      power: {
        status: power,
        label: power === "ac" ? "Conectada a corriente" : power === "battery" ? "Funcionando con batería" : "Estado no confirmado",
      },
      soundAlertsEnabled: this.state.soundAlertsEnabled,
      blocksNewSession: level === "critical" && (!connected || new Set(["error", "disconnected"]).has(backupStatus)),
    }
  }

  setCaptureSourceProvider(provider: () => { status: "ready" | "unavailable"; label: string; configured: boolean }): void {
    this.captureSourceProvider = provider
  }

  async assertCanStartSession(): Promise<void> {
    if ((await this.snapshot()).blocksNewSession) {
      throw new Error("El espacio interno es crítico. Conecta un SSD antes de iniciar otra sesión fotográfica.")
    }
  }

  async configureBackup(directory: string): Promise<OperationsSnapshot> {
    if (!path.isAbsolute(directory)) throw new Error("La ruta del SSD debe ser absoluta.")
    if (
      !this.allowTestFeatures && process.platform === "win32" &&
      path.parse(path.resolve(directory)).root.toLocaleLowerCase() === path.parse(path.resolve(this.dataDirectory)).root.toLocaleLowerCase()
    ) {
      throw new Error("El respaldo debe estar en una unidad distinta del disco interno.")
    }
    const details = await stat(directory)
    if (!details.isDirectory()) throw new Error("La ruta del SSD debe ser una carpeta existente.")
    await access(directory, constants.W_OK)
    this.state.backupDirectory = path.resolve(directory)
    this.state.backupStatus = "ready"
    this.state.backupError = null
    await this.persist()
    this.scheduleBackup()
    return this.snapshot()
  }

  async setSoundAlerts(enabled: boolean): Promise<OperationsSnapshot> {
    this.state.soundAlertsEnabled = enabled
    await this.persist()
    return this.snapshot()
  }

  scheduleBackup(): void {
    if (!this.state.backupDirectory) return
    this.backupQueue = this.backupQueue.then(() => this.performBackup()).catch(() => undefined)
  }

  async waitForBackup(): Promise<OperationsSnapshot> {
    let observedQueue: Promise<void>
    do {
      observedQueue = this.backupQueue
      await observedQueue
    } while (observedQueue !== this.backupQueue)
    return this.snapshot()
  }

  async setTestConditions(conditions: TestConditions): Promise<OperationsSnapshot> {
    if (!this.allowTestFeatures) throw new Error("Las condiciones operativas controladas solo están disponibles en verificaciones.")
    this.testConditions = { ...this.testConditions, ...conditions }
    if (conditions.backupDisconnected) {
      this.state.backupStatus = "disconnected"
      this.state.backupError = "El SSD se desconectó durante el respaldo."
      await this.persist()
    }
    return this.snapshot()
  }

  private async performBackup(): Promise<void> {
    if (!this.state.backupDirectory) return
    this.state.backupStatus = "copying"
    this.state.backupError = null
    await this.persist()
    try {
      if (this.testConditions.backupDisconnected) throw new Error("El SSD se desconectó durante el respaldo.")
      if (this.testConditions.backupCopyFailure) throw new Error("No se pudo verificar la copia escrita en el SSD.")
      const files = await this.eventDataFiles()
      let verifiedFiles = 0
      for (const sourcePath of files) {
        const relativePath = path.relative(this.dataDirectory, sourcePath)
        const destinationPath = path.join(this.state.backupDirectory, BACKUP_FOLDER_NAME, relativePath)
        await mkdir(path.dirname(destinationPath), { recursive: true })
        const temporaryPath = `${destinationPath}.tmp`
        await copyFile(sourcePath, temporaryPath)
        if (await sha256File(sourcePath) !== await sha256File(temporaryPath)) {
          throw new Error(`La copia de ${relativePath} no superó la verificación.`)
        }
        await rename(temporaryPath, destinationPath)
        verifiedFiles += 1
      }
      this.state.backupStatus = "verified"
      this.state.verifiedFiles = verifiedFiles
      this.state.lastVerifiedAt = new Date().toISOString()
    } catch (error) {
      this.state.backupStatus = this.testConditions.backupDisconnected ? "disconnected" : "error"
      this.state.backupError = error instanceof Error ? error.message : "El respaldo local falló."
    }
    await this.persist()
  }

  private async eventDataFiles(): Promise<string[]> {
    const files: string[] = []
    const visit = async (directory: string) => {
      try {
        for (const entry of await readdir(directory, { withFileTypes: true })) {
          const entryPath = path.join(directory, entry.name)
          if (entry.isDirectory()) await visit(entryPath)
          else if (!entry.name.endsWith(".tmp")) files.push(entryPath)
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
      }
    }
    await visit(path.join(this.dataDirectory, "events"))
    try {
      await access(path.join(this.dataDirectory, "workflow-state.json"))
      files.push(path.join(this.dataDirectory, "workflow-state.json"))
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
    }
    return files
  }

  private async backupConnected(): Promise<boolean> {
    if (!this.state.backupDirectory || this.testConditions.backupDisconnected) return false
    try {
      await access(this.state.backupDirectory, constants.W_OK)
      return true
    } catch {
      return false
    }
  }

  private async readFreeBytes(): Promise<number> {
    const details = await statfs(this.dataDirectory)
    return details.bavail * details.bsize
  }

  private async readPowerStatus(): Promise<OperationsSnapshot["power"]["status"]> {
    if (this.powerCache && this.powerCache.expiresAt > Date.now()) return this.powerCache.status
    let status: OperationsSnapshot["power"]["status"] = "unknown"
    if (process.platform === "win32") {
      try {
        const command = "$b=Get-CimInstance Win32_Battery -ErrorAction SilentlyContinue;if(!$b){'ac'}elseif($b.BatteryStatus -eq 1){'battery'}else{'ac'}"
        const result = await execFileAsync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", command], { timeout: 5_000 })
        const value = result.stdout.trim().toLocaleLowerCase()
        if (value === "ac" || value === "battery") status = value
      } catch {
        status = "unknown"
      }
    }
    this.powerCache = { status, expiresAt: Date.now() + POWER_CACHE_MILLISECONDS }
    return status
  }

  private get statePath(): string {
    return path.join(this.dataDirectory, "operations-state.json")
  }

  private async persist(): Promise<void> {
    await mkdir(this.dataDirectory, { recursive: true })
    const temporaryPath = `${this.statePath}.tmp`
    await writeFile(temporaryPath, `${JSON.stringify(this.state, null, 2)}\n`, "utf8")
    await rename(temporaryPath, this.statePath)
  }
}
