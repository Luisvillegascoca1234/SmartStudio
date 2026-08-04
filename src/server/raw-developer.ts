import { mkdir, readFile, rm, stat } from "node:fs/promises"
import path from "node:path"
import ExifReader from "exifreader"
import { runLocalProcess, type LocalProcessResult } from "./local-process.js"

type DevelopmentMethod = "controlled" | "darktable" | "rawpy"

const windowsDarktable = path.join(process.env.ProgramFiles ?? "C:\\Program Files", "darktable", "bin", "darktable-cli.exe")

const darktablePath = (value: string): string =>
  process.platform === "win32" ? value.replaceAll("\\", "/") : value

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
    private readonly darktableExecutable = process.env.SMARTSTUDIO_DARKTABLE,
  ) {}

  async develop(rawRelativePath: string | null, jpegPath: string, destination: string): Promise<{ method: DevelopmentMethod; lensCorrectionApplied: boolean; processingRoute: "cpu" | "gpu" }> {
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
      return { method: "controlled", lensCorrectionApplied: false, processingRoute: "cpu" }
    }
    if (header.toString("ascii").startsWith("SMARTSTUDIO_UNSUPPORTED_RAW")) {
      throw new RawDevelopmentError("unsupported", "Este formato RAW no es compatible con el revelador local.")
    }

    const darktableResult = await this.developWithDarktable(rawPath, destination)
    if (darktableResult.process?.code === 0) {
      const lensCorrectionApplied = await this.correctLensWhenPossible(rawPath, destination)
      return { method: "darktable", lensCorrectionApplied, processingRoute: darktableResult.openClEnabled ? "gpu" : "cpu" }
    }

    const script = path.resolve("scripts", "develop-raw.py")
    const result = await runLocalProcess(this.pythonExecutable, [script, rawPath, destination]).catch((error) => {
      const darktableDetails = ` darktable: ${darktableResult.failureDetail}.`
      throw new RawDevelopmentError("unsupported", `El revelador RAW local no está disponible:${darktableDetails} ${error instanceof Error ? error.message : "error desconocido"}`)
    })
    if (result.code === 0) {
      const lensCorrectionApplied = await this.correctLensWhenPossible(rawPath, destination)
      return { method: "rawpy", lensCorrectionApplied, processingRoute: "cpu" }
    }
    await rm(destination, { force: true })
    const normalized = result.stderr.toLocaleLowerCase()
    if (normalized.includes("unsupported") || normalized.includes("not raw")) {
      throw new RawDevelopmentError("unsupported", "La cámara o variante del RAW no es compatible con LibRaw/rawpy.")
    }
    throw new RawDevelopmentError("corrupt", "El RAW está corrupto o incompleto y no pudo revelarse.")
  }

  private async developWithDarktable(rawPath: string, destination: string): Promise<{
    process: LocalProcessResult | null
    openClEnabled: boolean
    failureDetail: string
  }> {
    const configDirectory = path.join(this.dataDirectory, "darktable-config")
    await mkdir(configDirectory, { recursive: true })
    await rm(destination, { force: true })
    const candidates = [
      this.darktableExecutable,
      "darktable-cli",
      ...(process.platform === "win32" ? [windowsDarktable] : []),
    ].filter((candidate, index, all): candidate is string => Boolean(candidate) && all.indexOf(candidate) === index)
    const launchFailures: string[] = []
    for (const executable of candidates) {
      try {
        const processResult = await runLocalProcess(executable, [
          darktablePath(rawPath),
          darktablePath(destination),
          "--apply-custom-presets", "false",
          "--out-ext", "tif",
          "--hq", "true",
          "--icc-type", "SRGB",
          "--core",
          "--configdir", darktablePath(configDirectory),
          "--library", ":memory:",
          "--conf", "plugins/imageio/format/tiff/bpp=16",
        ])
        if (processResult.code === 0) await stat(destination)
        else await rm(destination, { force: true })
        const configuration = await readFile(path.join(configDirectory, "darktablerc"), "utf8").catch(() => "")
        return {
          process: processResult,
          openClEnabled: /^opencl=true$/mu.test(configuration),
          failureDetail: processResult.stderr.trim() || `el proceso terminó con código ${processResult.code ?? "desconocido"}`,
        }
      } catch (error) {
        launchFailures.push(`${executable}: ${error instanceof Error ? error.message : "no se pudo iniciar"}`)
        await rm(destination, { force: true })
      }
    }
    return { process: null, openClEnabled: false, failureDetail: launchFailures.join("; ") || "no se encontró el ejecutable" }
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
      const correctedPath = `${developedPath}.lens${path.extname(developedPath) || ".tif"}`
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
