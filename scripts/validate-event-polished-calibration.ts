import { createHash } from "node:crypto"
import { mkdir, readFile, stat, writeFile } from "node:fs/promises"
import path from "node:path"
import sharp from "sharp"
import { EVENT_POLISHED_RECIPE_SHA256, EVENT_POLISHED_RECIPE_VERSION } from "../src/server/event-polished-recipe.js"

type CalibrationCase = {
  id: string
  camera: string
  raw: string
  result: string
  reference: string
  tags: string[]
  approvedAtNormalSize: boolean
  approvedAt100Percent: boolean
  reviewer: string
}

const requiredTags = [
  "correct-exposure", "moderate-underexposure", "low-iso", "high-iso", "light-skin", "dark-skin",
  "textured-skin", "light-clothes", "dark-clothes", "glasses", "beard", "makeup", "single", "couple",
  "group", "red-eye", "partial-eye", "visible-teeth", "no-visible-teeth", "complete-backdrop",
  "interrupted-backdrop", "nonuniform-backdrop",
]

const manifestPath = process.env.SMARTSTUDIO_CALIBRATION_MANIFEST
if (!manifestPath) throw new Error("Define SMARTSTUDIO_CALIBRATION_MANIFEST con el conjunto Sony A7 IV autorizado y sus referencias aprobadas.")
const manifest = JSON.parse(await readFile(path.resolve(manifestPath), "utf8")) as { cases?: CalibrationCase[] }
const cases = manifest.cases ?? []
const covered = new Set(cases.flatMap((item) => item.tags))
const missingTags = requiredTags.filter((tag) => !covered.has(tag))
const failures: string[] = []
if (cases.length < 8) failures.push("Se requieren al menos 8 casos independientes.")
if (missingTags.length) failures.push(`Cobertura ausente: ${missingTags.join(", ")}.`)

const hash = async (file: string) => createHash("sha256").update(await readFile(file)).digest("hex")
const evidence = []
for (const item of cases) {
  if (!/^Sony ILCE-7M4$/iu.test(item.camera)) failures.push(`${item.id}: la cámara no está declarada como Sony ILCE-7M4.`)
  if (!item.reviewer.trim() || !item.approvedAtNormalSize || !item.approvedAt100Percent) failures.push(`${item.id}: falta aprobación visual humana a tamaño normal y 100 %.`)
  for (const file of [item.raw, item.result, item.reference]) await stat(path.resolve(file))
  const [resultMetadata, referenceMetadata] = await Promise.all([sharp(path.resolve(item.result)).metadata(), sharp(path.resolve(item.reference)).metadata()])
  if (!resultMetadata.width || !resultMetadata.height || !referenceMetadata.width || !referenceMetadata.height) failures.push(`${item.id}: resultado o referencia ilegible.`)
  evidence.push({
    id: item.id, tags: item.tags, reviewer: item.reviewer,
    rawSha256: await hash(path.resolve(item.raw)), resultSha256: await hash(path.resolve(item.result)), referenceSha256: await hash(path.resolve(item.reference)),
    result: { width: resultMetadata.width, height: resultMetadata.height, format: resultMetadata.format, depth: resultMetadata.depth },
  })
}
if (failures.length) throw new Error(failures.join("\n"))

const dataDirectory = path.resolve(process.env.SMARTSTUDIO_DATA_DIR ?? ".smartstudio-data")
const destinationDirectory = path.join(dataDirectory, "validation")
await mkdir(destinationDirectory, { recursive: true })
const destination = path.join(destinationDirectory, "event-polished-v1-calibration.json")
await writeFile(destination, `${JSON.stringify({
  validatedAt: new Date().toISOString(), recipeVersion: EVENT_POLISHED_RECIPE_VERSION,
  recipeSha256: EVENT_POLISHED_RECIPE_SHA256, camera: "Sony ILCE-7M4", requiredTags, evidence,
  canonValidation: "not-in-scope", lessControlledSonyValidation: "not-in-scope",
}, null, 2)}\n`, "utf8")
console.log(JSON.stringify({ destination, cases: cases.length, recipeVersion: EVENT_POLISHED_RECIPE_VERSION }, null, 2))
