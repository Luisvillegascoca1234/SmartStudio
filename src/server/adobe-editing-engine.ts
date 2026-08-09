import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import sharp from "sharp"

import type { Capture, EditingJob } from "../shared/workflow.js"
import type { EditingEngine, EditingRenderResult } from "./editing-engine.js"
import { runLocalProcess } from "./local-process.js"

type AdobeProcessResult = {
  token: string
  jobId: string
  captureId: string
  outputPath: string
}

export class AdobeEditingEngine implements EditingEngine {
  readonly id = "adobe" as const
  readonly outputStrategy = "full-once" as const

  constructor(
    private readonly dataDirectory: string,
    private readonly executable = process.execPath,
    private readonly baseArguments = [path.resolve("scripts", "controlled-adobe-engine.mjs")],
  ) {}

  async render(
    job: EditingJob,
    capture: Capture,
    destination: string,
    origin: "raw" | "jpeg",
    _lightweight: boolean,
    signal?: AbortSignal,
  ): Promise<EditingRenderResult> {
    if (!capture.jpegRelativePath) throw new Error("La copia de trabajo Adobe necesita el JPEG asociado.")
    const token = crypto.randomUUID()
    const versionNumber = job.versions.length + 1
    const workDirectory = path.join(this.dataDirectory, "adobe-exchange", "incoming", `${job.id}-v${versionNumber}-${token}`)
    await mkdir(workDirectory, { recursive: true })
    await mkdir(path.dirname(destination), { recursive: true })
    const jpegCopy = path.join(workDirectory, `${capture.baseName}.jpg`)
    await copyFile(path.join(this.dataDirectory, capture.jpegRelativePath), jpegCopy)
    let rawCopy: string | null = null
    if (capture.rawRelativePath) {
      rawCopy = path.join(workDirectory, path.basename(capture.rawRelativePath))
      await copyFile(path.join(this.dataDirectory, capture.rawRelativePath), rawCopy)
    }
    const resultPath = path.join(workDirectory, "result.json")
    const requestPath = path.join(workDirectory, "request.json")
    await writeFile(requestPath, `${JSON.stringify({
      contractVersion: 1,
      token,
      jobId: job.id,
      captureId: capture.id,
      baseName: capture.baseName,
      origin,
      profile: job.profile,
      adobeResources: job.adobeResources,
      adjustments: job.adjustments,
      automation: job.automation === "backdrop" ? "SmartStudio-Fondo" : "SmartStudio-Natural",
      input: { rawCopy, jpegCopy },
      outputPath: destination,
      resultPath,
    }, null, 2)}\n`, "utf8")
    const processResult = await runLocalProcess(this.executable, [...this.baseArguments, requestPath], undefined, signal)
    if (processResult.code !== 0) {
      throw new Error(`La automatización Adobe terminó con código ${processResult.code}: ${processResult.stderr.trim()}`)
    }
    const result = JSON.parse(await readFile(resultPath, "utf8")) as AdobeProcessResult
    if (
      result.token !== token || result.jobId !== job.id || result.captureId !== capture.id ||
      path.resolve(result.outputPath) !== path.resolve(destination)
    ) throw new Error("La salida Adobe no conserva una asociación inequívoca con el trabajo solicitado.")
    const [output, source] = await Promise.all([sharp(destination).metadata(), sharp(jpegCopy).metadata()])
    if (
      output.format !== "jpeg" || output.space !== "srgb" || !output.width || !output.height ||
      !source.width || !source.height || output.width !== source.width || output.height !== source.height || output.exif
    ) throw new Error("La salida Adobe no superó la validación de lectura, dimensiones, color o metadatos.")
    return {
      lensCorrectionApplied: true,
      portraitResult: {
        faces: 0,
        treated: 0,
        eyesEnhanced: false,
        teethWhitened: false,
        warnings: [],
        backdrop: job.automation === "backdrop" ? "completed" : "unchanged",
        backdropDiagnostics: null,
      },
      processingRoute: "cpu",
      usedRawFallback: false,
    }
  }
}
