import { readFile, writeFile } from "node:fs/promises"
import sharp from "sharp"

const requestPath = process.argv[2]
if (!requestPath) throw new Error("Falta la ruta del contrato Adobe.")
const request = JSON.parse(await readFile(requestPath, "utf8"))
if (request.contractVersion !== 1 || !["SmartStudio-Natural", "SmartStudio-Fondo"].includes(request.automation)) {
  throw new Error("Contrato o automatización Adobe no reconocidos.")
}
const adjustments = request.adjustments ?? { exposure: 0, temperature: 0, colorIntensity: 0, skinSmoothing: 1 }
const temperature = Math.max(-1, Math.min(1, adjustments.temperature))
let output = sharp(request.input.jpegCopy)
  .rotate()
  .recomb([
    [1 + temperature * 0.06, 0, 0],
    [0, 1, 0],
    [0, 0, 1 - temperature * 0.06],
  ])
  .gamma(1.04)
  .modulate({
    brightness: 1.015 + Math.max(-1, Math.min(1, adjustments.exposure)) * 0.1,
    saturation: 1.035 + Math.max(-1, Math.min(1, adjustments.colorIntensity)) * 0.1,
  })
  .toColourspace("srgb")
if (adjustments.skinSmoothing > 0) output = output.median(3)
await output
  .jpeg({ quality: 94, chromaSubsampling: "4:4:4" })
  .toFile(request.outputPath)
await writeFile(request.resultPath, `${JSON.stringify({
  token: request.token,
  jobId: request.jobId,
  captureId: request.captureId,
  outputPath: request.outputPath,
})}\n`, "utf8")
