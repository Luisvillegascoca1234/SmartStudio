import { createHash } from "node:crypto"
import { access, mkdir, readFile, readdir, writeFile } from "node:fs/promises"
import path from "node:path"
import sharp from "sharp"

import { PortraitRetoucher } from "../src/server/portrait-retoucher.js"
import type { BackdropCompletion } from "../src/shared/workflow.js"

type CaseConfig = {
  expected: BackdropCompletion
  skinSmoothing?: number
  maxProtectedChangedPercent?: number
  maxProtectedMeanDifference?: number
  notes?: string
}

type CaseResult = {
  id: string
  expected: BackdropCompletion
  actual: BackdropCompletion
  passed: boolean
  durationMilliseconds: number
  faces: number
  eyesEnhanced: boolean
  teethWhitened: boolean
  warnings: string[]
  diagnostics: unknown
  protectedChangedPercent: number | null
  protectedMeanDifference: number | null
  originalHashPreserved: boolean
  errors: string[]
}

const datasetDirectory = path.resolve(process.argv[2] ?? path.join(".smartstudio-data", "qa-fondo"))
const casesDirectory = path.join(datasetDirectory, "cases")
const runId = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-")
const runDirectory = path.join(datasetDirectory, "runs", runId)
const retoucher = new PortraitRetoucher()
const digest = (value: Buffer): string => createHash("sha256").update(value).digest("hex")

const findInput = async (directory: string): Promise<string> => {
  const files = await readdir(directory)
  const input = files.find((file) => /^input\.(jpe?g|png)$/i.test(file))
  if (!input) throw new Error("Falta input.jpg, input.jpeg o input.png.")
  return path.join(directory, input)
}

const protectedDifference = async (naturalPath: string, fondoPath: string, maskPath: string): Promise<{ changedPercent: number; meanDifference: number }> => {
  const natural = await sharp(naturalPath).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  const fondo = await sharp(fondoPath).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  if (natural.info.width !== fondo.info.width || natural.info.height !== fondo.info.height) throw new Error("Natural y Fondo no conservaron las mismas dimensiones.")
  const mask = await sharp(maskPath)
    .resize(natural.info.width, natural.info.height, { fit: "fill" })
    .greyscale()
    .raw()
    .toBuffer()
  let protectedPixels = 0
  let changedPixels = 0
  let totalDifference = 0
  for (let pixel = 0; pixel < mask.length; pixel += 1) {
    if (mask[pixel] < 128) continue
    protectedPixels += 1
    const offset = pixel * 3
    const difference = (
      Math.abs(natural.data[offset] - fondo.data[offset]) +
      Math.abs(natural.data[offset + 1] - fondo.data[offset + 1]) +
      Math.abs(natural.data[offset + 2] - fondo.data[offset + 2])
    ) / 3
    totalDifference += difference
    if (difference > 2) changedPixels += 1
  }
  if (!protectedPixels) throw new Error("protected-mask.png no contiene píxeles protegidos.")
  return {
    changedPercent: changedPixels * 100 / protectedPixels,
    meanDifference: totalDifference / protectedPixels,
  }
}

const runCase = async (id: string): Promise<CaseResult> => {
  const sourceDirectory = path.join(casesDirectory, id)
  const outputDirectory = path.join(runDirectory, id)
  await mkdir(outputDirectory, { recursive: true })
  const config = JSON.parse(await readFile(path.join(sourceDirectory, "expected.json"), "utf8")) as CaseConfig
  const inputPath = await findInput(sourceDirectory)
  const naturalPath = path.join(outputDirectory, "natural.jpg")
  const fondoPath = path.join(outputDirectory, "fondo.jpg")
  const inputBefore = await readFile(inputPath)
  const skinSmoothing = Math.min(2, Math.max(0, config.skinSmoothing ?? 1))
  const startedAt = performance.now()
  await retoucher.apply(inputPath, naturalPath, skinSmoothing, undefined, false)
  const result = await retoucher.apply(inputPath, fondoPath, skinSmoothing, undefined, true)
  const durationMilliseconds = Math.round(performance.now() - startedAt)
  const errors: string[] = []
  if (result.backdrop !== config.expected) errors.push(`Se esperaba ${config.expected} y se obtuvo ${result.backdrop}.`)
  const originalHashPreserved = digest(inputBefore) === digest(await readFile(inputPath))
  if (!originalHashPreserved) errors.push("El archivo de entrada cambió durante la prueba.")
  const [naturalMetadata, fondoMetadata] = await Promise.all([sharp(naturalPath).metadata(), sharp(fondoPath).metadata()])
  if (naturalMetadata.width !== fondoMetadata.width || naturalMetadata.height !== fondoMetadata.height) errors.push("Natural y Fondo tienen dimensiones distintas.")
  let protectedChangedPercent: number | null = null
  let protectedMeanDifference: number | null = null
  const protectedMaskPath = path.join(sourceDirectory, "protected-mask.png")
  try {
    await access(protectedMaskPath)
    const difference = await protectedDifference(naturalPath, fondoPath, protectedMaskPath)
    protectedChangedPercent = difference.changedPercent
    protectedMeanDifference = difference.meanDifference
    const changedLimit = config.maxProtectedChangedPercent ?? .5
    const meanLimit = config.maxProtectedMeanDifference ?? 1
    if (difference.changedPercent > changedLimit) errors.push(`La región protegida cambió ${difference.changedPercent.toFixed(3)}%; máximo ${changedLimit}%.`)
    if (difference.meanDifference > meanLimit) errors.push(`La diferencia media protegida fue ${difference.meanDifference.toFixed(3)}; máximo ${meanLimit}.`)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") errors.push(error instanceof Error ? error.message : String(error))
  }
  return {
    id,
    expected: config.expected,
    actual: result.backdrop,
    passed: errors.length === 0,
    durationMilliseconds,
    faces: result.faces,
    eyesEnhanced: result.eyesEnhanced,
    teethWhitened: result.teethWhitened,
    warnings: result.warnings,
    diagnostics: result.backdropDiagnostics,
    protectedChangedPercent,
    protectedMeanDifference,
    originalHashPreserved,
    errors,
  }
}

await mkdir(runDirectory, { recursive: true })
const caseIds = (await readdir(casesDirectory, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort()
if (!caseIds.length) throw new Error(`No hay casos bajo ${casesDirectory}.`)
const results: CaseResult[] = []
for (const id of caseIds) results.push(await runCase(id))
const passed = results.filter((result) => result.passed).length
const durations = results.map((result) => result.durationMilliseconds).sort((first, second) => first - second)
const p95Index = Math.max(0, Math.ceil(durations.length * .95) - 1)
const summary = { runId, datasetDirectory, cases: results.length, passed, failed: results.length - passed, p95Milliseconds: durations[p95Index], results }
await writeFile(path.join(runDirectory, "report.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8")
const markdown = [
  `# Validación SmartStudio-Fondo ${runId}`,
  "",
  `- Casos: ${results.length}`,
  `- Aprobados: ${passed}`,
  `- Fallidos: ${results.length - passed}`,
  `- P95: ${durations[p95Index]} ms`,
  "",
  "| Caso | Esperado | Obtenido | Tiempo | Protección | Estado |",
  "|---|---|---|---:|---:|---|",
  ...results.map((result) => `| ${result.id} | ${result.expected} | ${result.actual} | ${result.durationMilliseconds} ms | ${result.protectedChangedPercent === null ? "—" : `${result.protectedChangedPercent.toFixed(3)}%`} | ${result.passed ? "Aprobado" : result.errors.join(" ")} |`),
  "",
].join("\n")
await writeFile(path.join(runDirectory, "report.md"), markdown, "utf8")
console.log(JSON.stringify({ runDirectory, cases: results.length, passed, failed: results.length - passed, p95Milliseconds: durations[p95Index] }, null, 2))
if (passed !== results.length) process.exitCode = 1
