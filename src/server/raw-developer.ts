import { readFile, rm, stat } from "node:fs/promises"
import path from "node:path"
import ExifReader from "exifreader"
import { runLocalProcess } from "./local-process.js"

export class RawDevelopmentError extends Error {
  constructor(
    public readonly kind: "missing" | "corrupt" | "unsupported",
    message: string,
  ) {
    super(message)
  }
}

export class RawDeveloper {
  constructor(
    private readonly dataDirectory: string,
    private readonly pythonExecutable = process.env.SMARTSTUDIO_PYTHON ?? "python",
  ) {}

  async develop(rawRelativePath: string | null, jpegPath: string, destination: string): Promise<{ method: "controlled" | "rawpy"; lensCorrectionApplied: boolean }> {
    if (!rawRelativePath) {
      throw new RawDevelopmentError("missing", "El archivo RAW todavía no llegó. Puedes esperar o autorizar procesar desde JPEG.")
    }
    const rawPath = path.join(this.dataDirectory, rawRelativePath)
    try {
      await stat(rawPath)
    } catch {
      throw new RawDevelopmentError("missing", "No se encontró el RAW original. Puedes autorizar procesar desde JPEG.")
    }

    const header = await readFile(rawPath).then((contents) => contents.subarray(0, 40))
    if (header.toString("ascii").startsWith("SMARTSTUDIO_SIMULATED_RAW")) {
      await import("node:fs/promises").then(({ copyFile }) => copyFile(jpegPath, destination))
      return { method: "controlled", lensCorrectionApplied: false }
    }
    if (header.toString("ascii").startsWith("SMARTSTUDIO_UNSUPPORTED_RAW")) {
      throw new RawDevelopmentError("unsupported", "Este formato RAW no es compatible con el revelador local.")
    }

    const script = path.resolve("scripts", "develop-raw.py")
    const result = await runLocalProcess(this.pythonExecutable, [script, rawPath, destination]).catch((error) => {
      throw new RawDevelopmentError("unsupported", `El revelador RAW local no está disponible: ${error instanceof Error ? error.message : "error desconocido"}`)
    })
    if (result.code === 0) {
      const lensCorrectionApplied = await this.correctLensWhenPossible(rawPath, destination)
      return { method: "rawpy", lensCorrectionApplied }
    }
    await rm(destination, { force: true })
    const normalized = result.stderr.toLocaleLowerCase()
    if (normalized.includes("unsupported") || normalized.includes("not raw")) {
      throw new RawDevelopmentError("unsupported", "La cámara o variante del RAW no es compatible con LibRaw/rawpy.")
    }
    throw new RawDevelopmentError("corrupt", "El RAW está corrupto o incompleto y no pudo revelarse.")
  }

  private async correctLensWhenPossible(rawPath: string, developedPath: string): Promise<boolean> {
    try {
      const tags = await ExifReader.load(rawPath)
      const description = (name: string): string => String(tags[name]?.description ?? "")
      const numeric = (name: string): number => {
        const tag = tags[name] as { computed?: unknown; value?: unknown; description?: string } | undefined
        const value = tag?.computed ?? tag?.value
        if (typeof value === "number") return value
        if (Array.isArray(value) && value.length === 2 && value.every((item) => typeof item === "number")) {
          return value[1] === 0 ? Number.NaN : value[0] / value[1]
        }
        return Number.parseFloat(String(tag?.description ?? "").replace(/^[^\d.-]+/, ""))
      }
      const maker = description("Make")
      const model = description("Model")
      const lens = description("LensModel")
      const focal = numeric("FocalLength")
      const aperture = numeric("FNumber")
      if (!maker || !model || !lens || !Number.isFinite(focal) || !Number.isFinite(aperture)) return false
      const correctedPath = `${developedPath}.lens.png`
      const script = path.resolve("scripts", "lens-correct.py")
      const result = await runLocalProcess(this.pythonExecutable, [script, developedPath, correctedPath, maker, model, lens, String(focal), String(aperture)])
      if (result.code !== 0) return false
      const parsed = JSON.parse(result.stdout) as { applied: boolean }
      if (!parsed.applied) {
        await rm(correctedPath, { force: true })
        return false
      }
      await rm(developedPath, { force: true })
      await import("node:fs/promises").then(({ rename }) => rename(correctedPath, developedPath))
      return true
    } catch {
      return false
    }
  }
}
