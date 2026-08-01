import sharp from "sharp"

import type { QualityAssessment, QualityWarning } from "../shared/workflow.js"

const DARK_EXPOSURE_MEAN = 38
const BRIGHT_EXPOSURE_MEAN = 218
const LOW_SHARPNESS = 1.2
const MOTION_GRADIENT_RATIO = 1.7
const MOTION_MINIMUM_SHARPNESS = 0.25
const WARNING_SCORE_PENALTY = 16
const ANALYSIS_WIDTH = 160
const RED_LUMINANCE_WEIGHT = 0.299
const GREEN_LUMINANCE_WEIGHT = 0.587
const BLUE_LUMINANCE_WEIGHT = 0.114
const SKIN_MINIMUM_RED = 145
const SKIN_MINIMUM_GREEN = 85
const SKIN_MINIMUM_BLUE = 55
const SKIN_MINIMUM_RED_BLUE_DISTANCE = 35
const FRAME_EDGE_MARGIN_PIXELS = 1
const EYE_BAND_START_RATIO = 0.25
const EYE_BAND_END_RATIO = 0.55
const DARK_FEATURE_LUMINANCE = 55
const CLOSED_EYE_DARK_ROW_RATIO = 0.28

const visualWarnings = async (jpegPath: string): Promise<{ warnings: QualityWarning[]; gradientRatio: number }> => {
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
      const red = channel(x, y, 0)
      const green = channel(x, y, 1)
      const blue = channel(x, y, 2)
      if (
        red > SKIN_MINIMUM_RED && green > SKIN_MINIMUM_GREEN && blue > SKIN_MINIMUM_BLUE &&
        red > green && green > blue && red - blue > SKIN_MINIMUM_RED_BLUE_DISTANCE
      ) {
        skinMinX = Math.min(skinMinX, x)
        skinMaxX = Math.max(skinMaxX, x)
        skinMinY = Math.min(skinMinY, y)
        skinMaxY = Math.max(skinMaxY, y)
      }
    }
  }

  const warnings: QualityWarning[] = []
  const gradientRatio = Math.max(horizontalGradient, verticalGradient) / Math.max(1, Math.min(horizontalGradient, verticalGradient))
  if (skinMaxX >= 0) {
    const touchesFrame =
      skinMinX <= FRAME_EDGE_MARGIN_PIXELS || skinMaxX >= info.width - 1 - FRAME_EDGE_MARGIN_PIXELS ||
      skinMinY <= FRAME_EDGE_MARGIN_PIXELS || skinMaxY >= info.height - 1 - FRAME_EDGE_MARGIN_PIXELS
    if (touchesFrame) warnings.push("poor-framing")

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
    if (longestDarkRow > faceWidth * CLOSED_EYE_DARK_ROW_RATIO) warnings.push("eyes-closed")
  }
  return { warnings, gradientRatio }
}

export async function assessJpeg(jpegPath: string): Promise<QualityAssessment> {
  const stats = await sharp(jpegPath).stats()
  const mean = stats.channels.slice(0, 3).reduce((sum, channel) => sum + channel.mean, 0) / 3
  const visual = await visualWarnings(jpegPath)
  const warnings = new Set<QualityWarning>(visual.warnings)
  if (mean < DARK_EXPOSURE_MEAN || mean > BRIGHT_EXPOSURE_MEAN) warnings.add("exposure")
  if (
    visual.gradientRatio > MOTION_GRADIENT_RATIO &&
    stats.sharpness >= MOTION_MINIMUM_SHARPNESS &&
    stats.sharpness < LOW_SHARPNESS
  ) warnings.add("motion")
  if (stats.sharpness < LOW_SHARPNESS && !warnings.has("motion") && !warnings.has("exposure")) warnings.add("blur")
  return {
    score: Math.max(0, 100 - warnings.size * WARNING_SCORE_PENALTY),
    warnings: [...warnings],
    analyzedAt: new Date().toISOString(),
    method: "local-heuristic",
  }
}
