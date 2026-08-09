import { spawn, type ChildProcess } from "node:child_process"
import { constants } from "node:fs"
import { copyFile, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises"
import path from "node:path"
import sharp from "sharp"

import type { Capture, EditingJob, ProcessingRoute } from "../shared/workflow.js"
import type { EditingEngine, EditingRenderResult } from "./editing-engine.js"
import { runLocalProcess } from "./local-process.js"
import { PortraitRetoucher, type PortraitResult } from "./portrait-retoucher.js"

type PhotoshopDropletOptions = {
  dropletPath?: string
  presetPath?: string
  timeoutMilliseconds?: number
  processingRoute?: ProcessingRoute
}

const startWindowsFocusGuard = async (timeoutMilliseconds: number): Promise<ChildProcess | null> => {
  if (process.platform !== "win32") return null
  const iterations = Math.ceil(timeoutMilliseconds / 100)
  const script = `Add-Type @'\nusing System; using System.Runtime.InteropServices; public static class SmartStudioFocus { [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow(); [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h); [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int command); [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint p); }\n'@; $target=[SmartStudioFocus]::GetForegroundWindow(); for($i=0;$i -lt ${iterations};$i++){ Start-Sleep -Milliseconds 100; $current=[SmartStudioFocus]::GetForegroundWindow(); $pidValue=[uint32]0; [SmartStudioFocus]::GetWindowThreadProcessId($current,[ref]$pidValue)|Out-Null; $name=(Get-Process -Id $pidValue -ErrorAction SilentlyContinue).ProcessName; if($name -eq 'Photoshop' -or $name -like 'SmartStudio-Natural*'){[SmartStudioFocus]::ShowWindow($current,6)|Out-Null; [SmartStudioFocus]::SetForegroundWindow($target)|Out-Null} }`
  const guard = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], { windowsHide: true })
  await new Promise((resolve) => setTimeout(resolve, 200))
  return guard
}

const waitForStableFile = async (filePath: string, timeoutMilliseconds: number): Promise<void> => {
  const deadline = Date.now() + timeoutMilliseconds
  let previousSize = -1
  let stableChecks = 0
  while (Date.now() < deadline) {
    try {
      const current = await stat(filePath)
      if (current.size > 0 && current.size === previousSize) {
        stableChecks += 1
        if (stableChecks >= 2) return
      } else {
        stableChecks = 0
        previousSize = current.size
      }
    } catch {
      stableChecks = 0
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error("Photoshop no produjo una salida estable dentro del tiempo esperado.")
}

export class PhotoshopDropletEngine implements EditingEngine {
  readonly id = "adobe" as const
  readonly outputStrategy = "full-once" as const
  private readonly dataDirectory: string
  private readonly resourcesDirectory: string
  private readonly dropletPath: string
  private readonly presetPath: string
  private readonly actionPath: string
  private readonly timeoutMilliseconds: number
  private readonly portraitRetoucher: PortraitRetoucher
  private readonly processingRoute: ProcessingRoute

  constructor(
    dataDirectory: string,
    options: PhotoshopDropletOptions = {},
  ) {
    this.dataDirectory = path.resolve(dataDirectory)
    this.resourcesDirectory = process.env.SMARTSTUDIO_ADOBE_RESOURCES ?? path.join(this.dataDirectory, "adobe-resources")
    this.dropletPath = options.dropletPath ?? process.env.SMARTSTUDIO_ADOBE_DROPLET ?? path.join(this.resourcesDirectory, "SmartStudio-Natural.exe")
    this.presetPath = options.presetPath ?? process.env.SMARTSTUDIO_ADOBE_PRESET ?? path.join(this.resourcesDirectory, "SmartStudio-Natural.xmp")
    this.actionPath = process.env.SMARTSTUDIO_ADOBE_ACTION ?? path.join(this.resourcesDirectory, "SmartStudio.atn")
    this.timeoutMilliseconds = options.timeoutMilliseconds ?? 120_000
    this.processingRoute = options.processingRoute ?? "cpu"
    this.portraitRetoucher = new PortraitRetoucher(path.join(this.dataDirectory, "models"))
  }

  async render(
    job: EditingJob,
    capture: Capture,
    destination: string,
    origin: "raw" | "jpeg",
    _lightweight: boolean,
    signal?: AbortSignal,
  ): Promise<EditingRenderResult> {
    if (!capture.jpegRelativePath) throw new Error("La copia de trabajo Adobe necesita el JPEG asociado.")
    if (origin === "raw" && !capture.rawRelativePath) throw new Error("La ruta Adobe RAW necesita el archivo RAW asociado.")

    const token = crypto.randomUUID()
    const archivedResources = await this.archiveResources(job)
    const versionNumber = job.versions.length + 1
    const workDirectory = path.join(this.dataDirectory, "adobe-exchange", "incoming", `${job.id}-v${versionNumber}-${token}`)
    await mkdir(workDirectory, { recursive: true })
    await mkdir(path.dirname(destination), { recursive: true })

    const sourceRelativePath = origin === "raw" ? capture.rawRelativePath! : capture.jpegRelativePath
    const sourceExtension = path.extname(sourceRelativePath)
    const sourceCopy = path.join(workDirectory, `${capture.baseName}${sourceExtension}`)
    const jpegCopy = path.join(workDirectory, `${capture.baseName}.reference.jpg`)
    await Promise.all([
      copyFile(path.join(this.dataDirectory, sourceRelativePath), sourceCopy),
      copyFile(path.join(this.dataDirectory, capture.jpegRelativePath), jpegCopy),
    ])
    if (origin === "raw") {
      await copyFile(archivedResources.preset, path.join(workDirectory, `${capture.baseName}.xmp`))
    }

    const requestPath = path.join(workDirectory, "request.json")
    const resultPath = path.join(workDirectory, "result.json")
    const dropletOutput = path.join(workDirectory, `${capture.baseName}-SmartStudio.jpg`)
    await writeFile(requestPath, `${JSON.stringify({
      contractVersion: 1,
      token,
      jobId: job.id,
      captureId: capture.id,
      origin,
      automation: job.automation === "backdrop" ? "SmartStudio-Fondo" : "SmartStudio-Natural",
      profile: job.profile,
      adobeResources: job.adobeResources,
      adjustments: job.adjustments,
      input: { sourceCopy, jpegReference: jpegCopy },
      outputPath: destination,
      dropletOutput,
      resultPath,
    }, null, 2)}\n`, "utf8")

    const focusGuard = await startWindowsFocusGuard(this.timeoutMilliseconds)
    let processResult
    try {
      processResult = await runLocalProcess(archivedResources.droplet, [sourceCopy], this.timeoutMilliseconds, signal)
    } finally {
      await new Promise((resolve) => setTimeout(resolve, 500))
      focusGuard?.kill()
    }
    await waitForStableFile(dropletOutput, this.timeoutMilliseconds)
    if (processResult.code !== 0 && processResult.code !== 1) {
      throw new Error(`El Droplet de Photoshop terminó con código ${processResult.code}: ${processResult.stderr.trim()}`)
    }
    const portraitOutput = path.join(workDirectory, `${capture.baseName}-Retrato.png`)
    const portraitResult: PortraitResult = await this.portraitRetoucher.apply(
      dropletOutput,
      portraitOutput,
      job.adjustments.skinSmoothing,
      undefined,
      job.automation === "backdrop",
    )
    const temperature = job.adjustments.temperature
    const normalized = sharp(portraitOutput)
      .rotate()
      .recomb([
        [1 + temperature * 0.06, 0, 0],
        [0, 1, 0],
        [0, 0, 1 - temperature * 0.06],
      ])
      .modulate({
        brightness: 1 + job.adjustments.exposure * 0.1,
        saturation: 1 + job.adjustments.colorIntensity * 0.1,
      })
      .toColourspace("srgb")
    await normalized
      .jpeg({ quality: 94, chromaSubsampling: "4:4:4" })
      .toFile(destination)
    await rm(dropletOutput, { force: true })
    await rm(portraitOutput, { force: true })

    const [output, reference] = await Promise.all([sharp(destination).metadata(), sharp(jpegCopy).metadata()])
    if (
      output.format !== "jpeg" || output.space !== "srgb" || !output.width || !output.height ||
      !reference.width || !reference.height || output.width !== reference.width || output.height !== reference.height || output.exif
    ) throw new Error("La salida real de Photoshop no superó la validación de lectura, dimensiones, color o metadatos.")

    const result = {
      contractVersion: 1,
      token,
      jobId: job.id,
      captureId: capture.id,
      outputPath: destination,
      dropletOutput,
    }
    await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8")
    const persisted = JSON.parse(await readFile(resultPath, "utf8")) as typeof result
    if (
      persisted.token !== token || persisted.jobId !== job.id || persisted.captureId !== capture.id ||
      path.resolve(persisted.outputPath) !== path.resolve(destination)
    ) throw new Error("La salida real de Photoshop perdió su asociación inequívoca con el trabajo.")

    return {
      lensCorrectionApplied: origin === "raw",
      portraitResult,
      processingRoute: this.processingRoute,
      usedRawFallback: false,
    }
  }

  private async archiveResources(job: EditingJob): Promise<{ preset: string; droplet: string }> {
    const safeVersion = job.adobeResources.bundleVersion.replace(/[^a-zA-Z0-9._-]/g, "_")
    const archive = path.join(this.dataDirectory, "adobe-resources", "archive", safeVersion)
    await mkdir(archive, { recursive: true })
    const preset = path.join(archive, "SmartStudio-Natural.xmp")
    const droplet = path.join(archive, "SmartStudio-Natural.exe")
    const action = path.join(archive, "SmartStudio.atn")
    const copyOnce = async (source: string, destination: string): Promise<void> => {
      try {
        await copyFile(source, destination, constants.COPYFILE_EXCL)
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error
      }
    }
    await Promise.all([
      copyOnce(this.presetPath, preset),
      copyOnce(this.dropletPath, droplet),
      copyOnce(this.actionPath, action),
      writeFile(path.join(archive, "snapshot.json"), `${JSON.stringify(job.adobeResources, null, 2)}\n`, { flag: "wx" }).catch((error) => {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error
      }),
    ])
    return { preset, droplet }
  }
}
