import { constants, copyFile, mkdir } from "node:fs/promises"
import path from "node:path"
import { sha256File } from "./file-hash.js"

export type CaptureComponentKind = "raw" | "jpeg"

export type IncorporatedComponent = {
  baseName: string
  fileName: string
  kind: CaptureComponentKind
  relativePath: string
  sha256: string
}

const rawExtensions = new Set([".arw", ".dng"])
const jpegExtensions = new Set([".jpg", ".jpeg"])

export const classifyCaptureFile = (fileName: string): CaptureComponentKind | null => {
  const extension = path.extname(fileName).toLowerCase()
  if (rawExtensions.has(extension)) return "raw"
  if (jpegExtensions.has(extension)) return "jpeg"
  return null
}

export async function incorporateOriginal(options: {
  dataDirectory: string
  eventId: string
  sessionId: string
  sourcePath: string
  sourceFileName: string
}): Promise<IncorporatedComponent> {
  const fileName = path.basename(options.sourceFileName)
  const kind = classifyCaptureFile(fileName)
  if (!kind) throw new Error(`Archivo no reconocido: ${fileName}`)

  const relativeDirectory = path.join(
    "events",
    options.eventId,
    "sessions",
    options.sessionId,
    "originals",
  )
  const destinationDirectory = path.join(options.dataDirectory, relativeDirectory)
  const destinationPath = path.join(destinationDirectory, fileName)
  await mkdir(destinationDirectory, { recursive: true })

  const sourceHash = await sha256File(options.sourcePath)
  try {
    await copyFile(options.sourcePath, destinationPath, constants.COPYFILE_EXCL)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error
    const existingHash = await sha256File(destinationPath)
    if (existingHash !== sourceHash) {
      throw new Error(`El original ${fileName} ya existe con contenido diferente.`)
    }
  }

  return {
    baseName: path.parse(fileName).name,
    fileName,
    kind,
    relativePath: path.join(relativeDirectory, fileName),
    sha256: sourceHash,
  }
}
