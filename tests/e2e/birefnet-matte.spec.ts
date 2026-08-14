import { copyFile, mkdir, mkdtemp, rm } from "node:fs/promises"
import { existsSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { expect, test } from "@playwright/test"
import sharp from "sharp"

import { PortraitRetoucher } from "../../src/server/portrait-retoucher.js"

const modelDirectory = path.resolve(".smartstudio-data", "models")
const validationPortrait = path.resolve(".smartstudio-data", "validation", "opacity-v1-115-developed.tif")
const candidateModel = path.join(modelDirectory, "birefnet-general-lite.onnx")

test("BiRefNet carga el checkpoint fijado, reutiliza sesión y recorre el flujo de composición", async () => {
  test.setTimeout(90_000)
  test.skip(!existsSync(candidateModel) || !existsSync(validationPortrait), "Requiere artefactos locales preparados fuera de Git.")
  const directory = await mkdtemp(path.join(tmpdir(), "smartstudio-birefnet-"))
  const retoucher = new PortraitRetoucher(modelDirectory, process.env.SMARTSTUDIO_PYTHON ?? "python", true, "birefnet", true)
  try {
    const metadata = await sharp(validationPortrait).metadata()
    const cleanPlate = path.join(directory, "clean-plate.tif")
    await sharp({
      create: { width: metadata.width!, height: metadata.height!, channels: 3, background: "#928d85" },
    }).tiff().toFile(cleanPlate)

    const firstDestination = path.join(directory, "first.tif")
    const first = await retoucher.apply(validationPortrait, firstDestination, 0, undefined, undefined, undefined, cleanPlate)
    const second = await retoucher.apply(validationPortrait, path.join(directory, "second.tif"), 0, undefined, undefined, undefined, cleanPlate)

    expect(first.matte).toMatchObject({
      provider: "birefnet",
      model: "birefnet-general-lite.onnx",
      modelVersion: "general-lite-epoch-232",
      modelSha256: "5600024376f572a557870a5eb0afb1e5961636bef4e1e22132025467d0f03333",
      processingRoute: "cpu",
      sessionReused: false,
    })
    expect(second.matte.sessionReused).toBe(true)
    expect(first.operations.backdrop).toBeDefined()
    expect((await sharp(firstDestination).metadata()).format).toBe("tiff")
  } finally {
    await retoucher.close()
    await rm(directory, { recursive: true, force: true })
  }
})

test("recurre a MediaPipe si el checkpoint candidato no está disponible", async () => {
  test.skip(!existsSync(validationPortrait), "Requiere la fotografía de validación local fuera de Git.")
  const directory = await mkdtemp(path.join(tmpdir(), "smartstudio-birefnet-fallback-"))
  const fallbackModels = path.join(directory, "models")
  await mkdir(fallbackModels)
  await copyFile(path.join(modelDirectory, "face_landmarker.task"), path.join(fallbackModels, "face_landmarker.task"))
  await copyFile(path.join(modelDirectory, "selfie_multiclass_256x256.tflite"), path.join(fallbackModels, "selfie_multiclass_256x256.tflite"))
  const retoucher = new PortraitRetoucher(fallbackModels, process.env.SMARTSTUDIO_PYTHON ?? "python", true, "birefnet", true)
  try {
    const result = await retoucher.apply(validationPortrait, path.join(directory, "fallback.tif"), 0)
    expect(result.matte.provider).toBe("mediapipe")
    expect(result.warnings.some((warning) => warning.includes("recurrió automáticamente a MediaPipe"))).toBe(true)
  } finally {
    await retoucher.close()
    await rm(directory, { recursive: true, force: true })
  }
})
