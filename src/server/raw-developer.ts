import { mkdir, readFile, rm, stat } from "node:fs/promises"
import path from "node:path"
import ExifReader from "exifreader"
import sharp from "sharp"
import { runLocalProcess, type LocalProcessDiagnostic, type LocalProcessResult } from "./local-process.js"
import { EVENT_POLISHED_DARKTABLE_VERSION } from "./event-polished-recipe.js"

type DevelopmentMethod = "controlled" | "darktable" | "rawpy"

export type RawDevelopmentResult = {
  method: DevelopmentMethod
  developerVersion: string
  lensCorrectionApplied: boolean
  processingRoute: "cpu" | "gpu"
  parameters: Record<string, string | number | boolean>
  warnings: string[]
  accelerationEvidence: "effective-opencl" | "cpu" | "inconclusive"
}

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
  private readonly darktableMode = process.env.SMARTSTUDIO_DARKTABLE_MODE ?? "auto"
  private readonly openClPriority = process.env.SMARTSTUDIO_DARKTABLE_OPENCL_PRIORITY
  private readonly darktableDisabled = process.env.SMARTSTUDIO_DARKTABLE_DISABLE === "1"
  constructor(
    private readonly dataDirectory: string,
    private readonly pythonExecutable = process.env.SMARTSTUDIO_PYTHON ?? "python",
    private readonly darktableExecutable = process.env.SMARTSTUDIO_DARKTABLE,
  ) {}

  async develop(rawRelativePath: string | null, jpegPath: string, recipePath: string, destination: string, signal?: AbortSignal, onDiagnostic?: (diagnostic: LocalProcessDiagnostic) => void): Promise<RawDevelopmentResult> {
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
      await sharp(jpegPath).rotate().toColourspace("rgb16").tiff({ compression: "lzw" }).toFile(destination)
      await this.validateMaster(destination)
      return { method: "controlled", developerVersion: "controlled-v1", lensCorrectionApplied: false, processingRoute: "cpu", parameters: { output: "TIFF 16-bit sRGB" }, warnings: [], accelerationEvidence: "cpu" }
    }
    if (header.toString("ascii").startsWith("SMARTSTUDIO_UNSUPPORTED_RAW")) {
      throw new RawDevelopmentError("unsupported", "Este formato RAW no es compatible con el revelador local.")
    }

    const darktableResult = await this.developWithDarktable(rawPath, recipePath, destination, signal, onDiagnostic)
    if (darktableResult.process?.termination === "cancelled") throw new Error("El revelado RAW fue cancelado.")
    if (darktableResult.process?.code === 0 && darktableResult.version === EVENT_POLISHED_DARKTABLE_VERSION) {
      const lensCorrectionApplied = await this.correctLensWhenPossible(rawPath, destination, signal, onDiagnostic)
      await this.validateMaster(destination)
      return {
        method: "darktable", developerVersion: darktableResult.version, lensCorrectionApplied,
        processingRoute: darktableResult.openClEnabled ? "gpu" : "cpu",
        parameters: { applyCustomPresets: false, highQuality: true, outputBits: 16, icc: "sRGB", recipe: "Evento pulido v1" },
        warnings: darktableResult.openClEnabled ? [] : ["darktable reveló por CPU; OpenCL no quedó confirmado para este trabajo."],
        accelerationEvidence: darktableResult.openClEnabled ? "effective-opencl" : "inconclusive",
      }
    }
    if (darktableResult.process?.code === 0) {
      await rm(destination, { force: true })
      darktableResult.failureDetail = `la receta Evento pulido v1 requiere ${EVENT_POLISHED_DARKTABLE_VERSION}; se encontró ${darktableResult.version}`
    }

    const script = path.resolve("scripts", "develop-raw.py")
    const result = await runLocalProcess(this.pythonExecutable, [script, rawPath, destination], {
      stage: "rawpy-development",
      timeoutMilliseconds: 90_000,
      signal,
      onDiagnostic,
    })
    if (result.termination === "cancelled") throw new Error("El revelado RAW fue cancelado.")
    if (result.termination === "timeout") throw new Error("El revelado RAW de respaldo excedió 90 segundos y fue terminado; puedes reintentar.")
    if (result.termination === "spawn-error") {
      throw new RawDevelopmentError("unsupported", `El revelador RAW local no está disponible: darktable: ${darktableResult.failureDetail}. rawpy: ${result.stderr || "no se pudo iniciar"}`)
    }
    if (result.code === 0) {
      const lensCorrectionApplied = await this.correctLensWhenPossible(rawPath, destination, signal, onDiagnostic)
      await this.validateMaster(destination)
      const reported = JSON.parse(result.stdout) as { version?: string; parameters?: Record<string, string | number | boolean> }
      return {
        method: "rawpy", developerVersion: `rawpy ${reported.version ?? "desconocida"}`, lensCorrectionApplied, processingRoute: "cpu",
        parameters: reported.parameters ?? { outputBits: 16, outputColor: "sRGB" },
        warnings: ["Se usó rawpy por CPU: el color y la reducción de ruido pueden diferir de la referencia darktable."],
        accelerationEvidence: "cpu",
      }
    }
    await rm(destination, { force: true })
    const normalized = result.stderr.toLocaleLowerCase()
    if (normalized.includes("unsupported") || normalized.includes("not raw")) {
      throw new RawDevelopmentError("unsupported", "La cámara o variante del RAW no es compatible con LibRaw/rawpy.")
    }
    throw new RawDevelopmentError("corrupt", "El RAW está corrupto o incompleto y no pudo revelarse.")
  }

  private async developWithDarktable(rawPath: string, recipePath: string, destination: string, signal?: AbortSignal, onDiagnostic?: (diagnostic: LocalProcessDiagnostic) => void): Promise<{
    process: LocalProcessResult | null
    openClEnabled: boolean
    failureDetail: string
    version: string
  }> {
    const configDirectory = path.join(this.dataDirectory, "darktable-config")
    await mkdir(configDirectory, { recursive: true })
    await rm(destination, { force: true })
    const candidates = (this.darktableDisabled ? [] : [
      this.darktableExecutable,
      "darktable-cli",
      ...(process.platform === "win32" ? [windowsDarktable] : []),
    ]).filter((candidate, index, all): candidate is string => Boolean(candidate) && all.indexOf(candidate) === index)
    const launchFailures: string[] = []
    for (const executable of candidates) {
      try {
        const processResult = await runLocalProcess(executable, [
          darktablePath(rawPath),
          darktablePath(recipePath),
          darktablePath(destination),
          "--apply-custom-presets", "false",
          "--out-ext", "tif",
          "--hq", "true",
          "--icc-type", "SRGB",
          ...(this.darktableMode === "cpu" ? ["--disable-opencl"] : []),
          "--core",
          "-d", "opencl",
          "--configdir", darktablePath(configDirectory),
          "--library", ":memory:",
          "--conf", "plugins/imageio/format/tiff/bpp=16",
          ...(this.darktableMode === "nvidia" && this.openClPriority ? ["--conf", `opencl_device_priority=${this.openClPriority}`] : []),
        ], { stage: "darktable-development", timeoutMilliseconds: 120_000, signal, onDiagnostic })
        if (processResult.termination === "spawn-error") {
          launchFailures.push(`${executable}: ${processResult.stderr || "no se pudo iniciar"}`)
          continue
        }
        if (processResult.code === 0) await stat(destination)
        else await rm(destination, { force: true })
        const configuration = await readFile(path.join(configDirectory, "darktablerc"), "utf8").catch(() => "")
        const versionResult = processResult.code === 0
          ? await runLocalProcess(executable, ["--version"], { stage: "darktable-version", timeoutMilliseconds: 5_000, signal, onDiagnostic })
          : null
        const openClDiagnostic = `${processResult.stdout}\n${processResult.stderr}`
        return {
          process: processResult,
          openClEnabled: this.darktableMode !== "cpu" && /^opencl=true$/mu.test(configuration) && /opencl.*(?:device|initiali[sz]ed|enabled)/iu.test(openClDiagnostic),
          failureDetail: processResult.stderr.trim() || `el proceso terminó con código ${processResult.code ?? "desconocido"}`,
          version: versionResult?.stdout.split(/\r?\n/u)[0]?.trim() || "darktable-desconocido",
        }
      } catch (error) {
        launchFailures.push(`${executable}: ${error instanceof Error ? error.message : "no se pudo iniciar"}`)
        await rm(destination, { force: true })
      }
    }
    return { process: null, openClEnabled: false, failureDetail: launchFailures.join("; ") || "no se encontró el ejecutable", version: "darktable-no-disponible" }
  }

  private async validateMaster(destination: string): Promise<void> {
    const metadata = await sharp(destination).metadata()
    if (metadata.format !== "tiff" || metadata.channels !== 3 || metadata.depth !== "ushort" || !metadata.width || !metadata.height) {
      await rm(destination, { force: true })
      throw new Error("El revelador no produjo un máster TIFF sRGB legible de tres canales y 16 bits.")
    }
  }

  private async correctLensWhenPossible(rawPath: string, developedPath: string, signal?: AbortSignal, onDiagnostic?: (diagnostic: LocalProcessDiagnostic) => void): Promise<boolean> {
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
      const result = await runLocalProcess(this.pythonExecutable, [script, developedPath, correctedPath, maker, model, lens, String(focal), String(aperture)], {
        stage: "lens-correction",
        timeoutMilliseconds: 30_000,
        signal,
        onDiagnostic,
      })
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
