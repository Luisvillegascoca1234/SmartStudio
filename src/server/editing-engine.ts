import { mkdir, rm } from "node:fs/promises"
import path from "node:path"
import sharp from "sharp"

import type { Capture, EditingEngineId, EditingJob, ProcessingRoute } from "../shared/workflow.js"
import { PortraitRetoucher, type PortraitFixture, type PortraitResult } from "./portrait-retoucher.js"
import { RawDeveloper } from "./raw-developer.js"

export type EditingRenderResult = {
  lensCorrectionApplied: boolean
  portraitResult: PortraitResult
  processingRoute: ProcessingRoute
  usedRawFallback: boolean
}

export interface EditingEngine {
  readonly id: EditingEngineId
  readonly outputStrategy?: "render-per-size" | "full-once"
  render(
    job: EditingJob,
    capture: Capture,
    destination: string,
    origin: "raw" | "jpeg",
    lightweight: boolean,
    signal?: AbortSignal,
  ): Promise<EditingRenderResult>
}

export class LocalEditingEngine implements EditingEngine {
  readonly id = "local" as const
  private readonly rawDeveloper: RawDeveloper
  private readonly portraitRetoucher: PortraitRetoucher

  constructor(
    private readonly dataDirectory: string,
    private readonly controlledPortraitFixture?: PortraitFixture,
  ) {
    this.rawDeveloper = new RawDeveloper(dataDirectory)
    this.portraitRetoucher = new PortraitRetoucher(path.join(dataDirectory, "models"))
  }

  async render(
    job: EditingJob,
    capture: Capture,
    destination: string,
    origin: "raw" | "jpeg",
    lightweight: boolean,
    _signal?: AbortSignal,
  ): Promise<EditingRenderResult> {
    if (!capture.jpegRelativePath) throw new Error("La fotografía necesita su JPEG asociado para generar la edición.")
    await mkdir(path.dirname(destination), { recursive: true })
    const jpegPath = path.join(this.dataDirectory, capture.jpegRelativePath)
    const developedRawPath = `${destination}.raw.tif`
    const styledPath = `${destination}.styled.jpg`
    const portraitPath = `${destination}.portrait.jpg`
    let sourceImagePath = jpegPath
    let lensCorrectionApplied = false
    let processingRoute: ProcessingRoute = "cpu"
    let usedRawFallback = false
    try {
      if (origin === "raw") {
        const rawResult = await this.rawDeveloper.develop(capture.rawRelativePath, jpegPath, developedRawPath)
        sourceImagePath = developedRawPath
        lensCorrectionApplied = rawResult.lensCorrectionApplied
        processingRoute = rawResult.processingRoute
        usedRawFallback = rawResult.method === "rawpy"
      }
      const temperature = job.adjustments.temperature
      await sharp(sourceImagePath)
        .rotate()
        .recomb([
          [1 + temperature * 0.06, 0, 0],
          [0, 1, 0],
          [0, 0, 1 - temperature * 0.06],
        ])
        .gamma(1.06)
        .linear(0.96, 4)
        .modulate({
          brightness: 1.02 + job.adjustments.exposure * 0.1,
          saturation: 1.05 + job.adjustments.colorIntensity * 0.1,
        })
        .median(3)
        .sharpen({ sigma: 0.55, m1: 0.35, m2: 1 })
        .jpeg({ quality: 94, chromaSubsampling: "4:4:4" })
        .toFile(styledPath)
      const portraitResult = await this.portraitRetoucher.apply(
        styledPath,
        portraitPath,
        job.adjustments.skinSmoothing,
        capture.source === "simulated-folder" ? this.controlledPortraitFixture ?? { kind: "single" } : undefined,
        job.automation === "backdrop",
      )
      let output = sharp(portraitPath).rotate().toColourspace("srgb")
      if (lightweight) output = output.resize(960, 960, { fit: "inside", withoutEnlargement: true })
      await output.jpeg({ quality: lightweight ? 86 : 94, chromaSubsampling: "4:4:4" }).toFile(destination)
      return { lensCorrectionApplied, portraitResult, processingRoute, usedRawFallback }
    } finally {
      await Promise.all([
        rm(developedRawPath, { force: true }),
        rm(styledPath, { force: true }),
        rm(portraitPath, { force: true }),
      ])
    }
  }
}
