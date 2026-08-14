import { copyFile, mkdir, rename, rm } from "node:fs/promises"
import path from "node:path"
import sharp from "sharp"

import type { WorkflowState } from "../shared/workflow.js"
import { sha256File } from "./file-hash.js"
import { runLocalProcess } from "./local-process.js"
import type { WorkflowStore } from "./workflow-store.js"

type ImportedCleanPlate = { filepath: string; filename: string }
type PersonValidation = { personDetected: boolean; method: "local-mediapipe" | "controlled-fixture" }

const formatExtension = (format?: string): string => {
  if (format === "jpeg") return ".jpg"
  if (format === "png") return ".png"
  if (format === "tiff") return ".tif"
  throw new Error("La placa limpia debe ser JPEG, PNG o TIFF.")
}

export class CleanPlateService {
  constructor(
    private readonly store: WorkflowStore,
    private readonly dataDirectory: string,
    private readonly controlledPersonDetected?: boolean,
    private readonly pythonExecutable = process.env.SMARTSTUDIO_PYTHON ?? "python",
    private readonly modelDirectory = process.env.SMARTSTUDIO_MODEL_DIR ?? path.resolve(".smartstudio-data", "models"),
  ) {}

  async register(eventId: string, files: ImportedCleanPlate[]): Promise<WorkflowState> {
    if (files.length !== 1) throw new Error("Selecciona exactamente una placa limpia.")
    const event = this.store.snapshot().events.find((item) => item.id === eventId)
    if (!event) throw new Error("El evento no existe.")
    if (event.status !== "active") throw new Error("Reabre el evento antes de registrar una placa limpia.")

    const source = files[0].filepath
    const metadata = await sharp(source, { failOn: "error" }).metadata().catch(() => {
      throw new Error("La placa limpia no es una imagen legible.")
    })
    if (!metadata.width || !metadata.height || metadata.width < 640 || metadata.height < 480) {
      throw new Error("La placa limpia debe medir al menos 640 × 480 píxeles.")
    }
    const extension = formatExtension(metadata.format)
    const personValidation = await this.validatePeople(source)
    if (personValidation.personDetected) {
      throw new Error("La placa limpia contiene una persona; captura el fondo sin invitados.")
    }

    const id = crypto.randomUUID()
    const relativePath = path.join("events", eventId, "clean-plates", `${id}${extension}`)
    const destination = path.join(this.dataDirectory, relativePath)
    const temporary = `${destination}.tmp`
    await mkdir(path.dirname(destination), { recursive: true })
    try {
      await copyFile(source, temporary)
      await rename(temporary, destination)
    } finally {
      await rm(temporary, { force: true })
    }
    const sha256 = await sha256File(destination)
    const now = new Date().toISOString()
    return this.store.mutate((state) => {
      const current = state.events.find((item) => item.id === eventId)
      if (!current) throw new Error("El evento no existe.")
      const supersedesId = current.activeCleanPlateId
      current.cleanPlates.push({
        id,
        relativePath,
        sha256,
        width: metadata.width!,
        height: metadata.height!,
        orientation: metadata.orientation ?? 1,
        createdAt: now,
        validatedAt: now,
        validationMethod: personValidation.method,
        supersedesId,
      })
      current.activeCleanPlateId = id
    })
  }

  private async validatePeople(source: string): Promise<PersonValidation> {
    if (typeof this.controlledPersonDetected === "boolean") {
      return { personDetected: this.controlledPersonDetected, method: "controlled-fixture" }
    }
    const result = await runLocalProcess(this.pythonExecutable, [
      path.resolve("scripts", "validate-clean-plate.py"),
      source,
      this.modelDirectory,
    ], { stage: "clean-plate-validation", timeoutMilliseconds: 30_000 })
    if (result.code !== 0 || result.termination !== "completed") {
      throw new Error(`No se pudo validar localmente la placa limpia: ${result.stderr.trim() || result.termination}`)
    }
    const validation = JSON.parse(result.stdout) as { personDetected?: unknown }
    return { personDetected: validation.personDetected === true, method: "local-mediapipe" }
  }
}
