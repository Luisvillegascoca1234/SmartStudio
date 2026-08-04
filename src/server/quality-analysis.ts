import path from "node:path"
import sharp from "sharp"

import type { QualityAssessment, QualityWarning } from "../shared/workflow.js"
import { runLocalProcess } from "./local-process.js"

const DARK_EXPOSURE_MEAN = 38
const BRIGHT_EXPOSURE_MEAN = 218
const LOW_SHARPNESS = .35
const MOTION_MAXIMUM_SHARPNESS = 1.2
const MOTION_GRADIENT_RATIO = 1.7
const MOTION_MINIMUM_SHARPNESS = .25
const WARNING_SCORE_PENALTY = 16
const ANALYSIS_WIDTH = 320
const RED_LUMINANCE_WEIGHT = .299
const GREEN_LUMINANCE_WEIGHT = .587
const BLUE_LUMINANCE_WEIGHT = .114
const SKIN_MINIMUM_RED = 145
const SKIN_MINIMUM_GREEN = 85
const SKIN_MINIMUM_BLUE = 55
const SKIN_MINIMUM_RED_BLUE_DISTANCE = 35
const FRAME_EDGE_MARGIN_PIXELS = 1
const FACE_FRAME_MARGIN = .01
const EYE_BAND_START_RATIO = .25
const EYE_BAND_END_RATIO = .55
const DARK_FEATURE_LUMINANCE = 55
const CLOSED_EYE_DARK_ROW_RATIO = .28
const CLOSED_EYE_BLENDSHAPE = .55

type FaceAnalysis = {
  available: boolean
  faces: Array<{
    bounds: { minX: number; maxX: number; minY: number; maxY: number }
    blinkLeft: number
    blinkRight: number
  }>
}

type AssessmentOptions = {
  controlledFixture?: boolean
  modelDirectory?: string
  pythonExecutable?: string
}

const analyzePixels = async (jpegPath: string, controlledFixture: boolean) => {
  const { data, info } = await sharp(jpegPath)
    .resize({ width: ANALYSIS_WIDTH, withoutEnlargement: true })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const channels = info.channels
  let horizontalGradient = 0
  let verticalGradient = 0
  let skinMinX = info.width
  let skinMaxX = -1
  let skinMinY = info.height
  let skinMaxY = -1

  const channel = (x: number, y: number, offset: number) => data[(y * info.width + x) * channels + offset]
  const luminance = (x: number, y: number) => {
    const red = channel(x, y, 0)
    const green = channel(x, y, 1)
    const blue = channel(x, y, 2)
    return RED_LUMINANCE_WEIGHT * red + GREEN_LUMINANCE_WEIGHT * green + BLUE_LUMINANCE_WEIGHT * blue
  }

  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      if (x > 0) horizontalGradient += Math.abs(luminance(x, y) - luminance(x - 1, y))
      if (y > 0) verticalGradient += Math.abs(luminance(x, y) - luminance(x, y - 1))
      if (!controlledFixture) continue
      const red = channel(x, y, 0)
      const green = channel(x, y, 1)
      const blue = channel(x, y, 2)
      if (
        red > SKIN_MINIMUM_RED && green > SKIN_MINIMUM_GREEN && blue > SKIN_MINIMUM_BLUE
        && red > green && green > blue && red - blue > SKIN_MINIMUM_RED_BLUE_DISTANCE
      ) {
        skinMinX = Math.min(skinMinX, x)
        skinMaxX = Math.max(skinMaxX, x)
        skinMinY = Math.min(skinMinY, y)
        skinMaxY = Math.max(skinMaxY, y)
      }
    }
  }

  const controlledWarnings: QualityWarning[] = []
  if (controlledFixture && skinMaxX >= 0) {
    const touchesFrame =
      skinMinX <= FRAME_EDGE_MARGIN_PIXELS || skinMaxX >= info.width - 1 - FRAME_EDGE_MARGIN_PIXELS
      || skinMinY <= FRAME_EDGE_MARGIN_PIXELS || skinMaxY >= info.height - 1 - FRAME_EDGE_MARGIN_PIXELS
    if (touchesFrame) controlledWarnings.push("poor-framing")

    const faceWidth = skinMaxX - skinMinX + 1
    const eyeTop = Math.round(skinMinY + (skinMaxY - skinMinY) * EYE_BAND_START_RATIO)
    const eyeBottom = Math.round(skinMinY + (skinMaxY - skinMinY) * EYE_BAND_END_RATIO)
    let longestDarkRow = 0
    for (let y = eyeTop; y <= eyeBottom; y += 1) {
      let darkPixels = 0
      for (let x = skinMinX; x <= skinMaxX; x += 1) {
        if (luminance(x, y) < DARK_FEATURE_LUMINANCE) darkPixels += 1
      }
      longestDarkRow = Math.max(longestDarkRow, darkPixels)
    }
    if (longestDarkRow > faceWidth * CLOSED_EYE_DARK_ROW_RATIO) controlledWarnings.push("eyes-closed")
  }
  return {
    controlledWarnings,
    gradientRatio: Math.max(horizontalGradient, verticalGradient) / Math.max(1, Math.min(horizontalGradient, verticalGradient)),
  }
}

const analyzeFaces = async (jpegPath: string, options: AssessmentOptions): Promise<FaceAnalysis> => {
  const modelDirectory = options.modelDirectory ?? process.env.SMARTSTUDIO_MODEL_DIR ?? path.resolve(".smartstudio-data", "models")
  const result = await runLocalProcess(options.pythonExecutable ?? process.env.SMARTSTUDIO_PYTHON ?? "python", [
    path.resolve("scripts", "analyze-face.py"),
    jpegPath,
    path.join(modelDirectory, "face_landmarker.task"),
  ]).catch(() => null)
  if (!result || result.code !== 0) return { available: false, faces: [] }
  try {
    return JSON.parse(result.stdout) as FaceAnalysis
  } catch {
    return { available: false, faces: [] }
  }
}

export async function assessJpeg(jpegPath: string, options: AssessmentOptions = {}): Promise<QualityAssessment> {
  const [stats, visual, faceAnalysis] = await Promise.all([
    sharp(jpegPath).stats(),
    analyzePixels(jpegPath, options.controlledFixture ?? false),
    options.controlledFixture ? Promise.resolve<FaceAnalysis>({ available: false, faces: [] }) : analyzeFaces(jpegPath, options),
  ])
  const mean = stats.channels.slice(0, 3).reduce((sum, channel) => sum + channel.mean, 0) / 3
  const warnings = new Set<QualityWarning>(visual.controlledWarnings)
  if (mean < DARK_EXPOSURE_MEAN || mean > BRIGHT_EXPOSURE_MEAN) warnings.add("exposure")
  if (
    visual.gradientRatio > MOTION_GRADIENT_RATIO
    && stats.sharpness >= MOTION_MINIMUM_SHARPNESS
    && stats.sharpness < MOTION_MAXIMUM_SHARPNESS
  ) warnings.add("motion")
  if (stats.sharpness < LOW_SHARPNESS && !warnings.has("motion") && !warnings.has("exposure")) warnings.add("blur")

  for (const face of faceAnalysis.faces) {
    if (
      face.bounds.minX <= FACE_FRAME_MARGIN || face.bounds.maxX >= 1 - FACE_FRAME_MARGIN
      || face.bounds.minY <= FACE_FRAME_MARGIN || face.bounds.maxY >= 1 - FACE_FRAME_MARGIN
    ) warnings.add("poor-framing")
    if (face.blinkLeft >= CLOSED_EYE_BLENDSHAPE && face.blinkRight >= CLOSED_EYE_BLENDSHAPE) warnings.add("eyes-closed")
  }
  return {
    score: Math.max(0, 100 - warnings.size * WARNING_SCORE_PENALTY),
    warnings: [...warnings],
    analyzedAt: new Date().toISOString(),
    method: faceAnalysis.available ? "local-mediapipe" : options.controlledFixture ? "controlled-fixture" : "local-heuristic",
  }
}
