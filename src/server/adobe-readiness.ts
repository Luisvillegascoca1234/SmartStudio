import { constants } from "node:fs"
import { access, mkdir, rm, writeFile } from "node:fs/promises"
import path from "node:path"

import type { AdobeReadiness, AdobeReadinessCheck } from "../shared/operations.js"

const firstAccessible = async (candidates: string[]): Promise<string | null> => {
  for (const candidate of candidates) {
    try {
      await access(candidate, constants.R_OK)
      return candidate
    } catch {
      // Continue with the next stable installation location.
    }
  }
  return null
}

export class AdobeReadinessProbe {
  constructor(private readonly dataDirectory: string) {}

  async inspect(): Promise<AdobeReadiness> {
    const programFiles = process.env.ProgramFiles ?? "C:\\Program Files"
    const commonFiles = process.env.CommonProgramFiles ?? path.join(programFiles, "Common Files")
    const resourcesDirectory = process.env.SMARTSTUDIO_ADOBE_RESOURCES ?? path.join(this.dataDirectory, "adobe-resources")
    const exchangeDirectory = process.env.SMARTSTUDIO_ADOBE_EXCHANGE ?? path.join(this.dataDirectory, "adobe-exchange")
    const photoshop = await firstAccessible([
      process.env.SMARTSTUDIO_PHOTOSHOP ?? "",
      path.join(programFiles, "Adobe", "Adobe Photoshop 2026", "Photoshop.exe"),
      path.join(programFiles, "Adobe", "Adobe Photoshop 2025", "Photoshop.exe"),
    ].filter(Boolean))
    const cameraRaw = await firstAccessible([
      process.env.SMARTSTUDIO_CAMERA_RAW ?? "",
      path.join(commonFiles, "Adobe", "Plug-Ins", "CC", "File Formats", "Camera Raw.8bi"),
    ].filter(Boolean))
    const preset = await firstAccessible([process.env.SMARTSTUDIO_ADOBE_PRESET ?? path.join(resourcesDirectory, "SmartStudio-Natural.xmp")])
    const droplet = await firstAccessible([process.env.SMARTSTUDIO_ADOBE_DROPLET ?? path.join(resourcesDirectory, "SmartStudio-Natural.exe")])
    const action = await firstAccessible([process.env.SMARTSTUDIO_ADOBE_ACTION ?? path.join(resourcesDirectory, "SmartStudio.atn")])
    const offlineResources = await firstAccessible([process.env.SMARTSTUDIO_ADOBE_MANIFEST ?? path.join(resourcesDirectory, "manifest.json")])
    const exchange = await this.inspectExchange(exchangeDirectory)
    const checks: AdobeReadinessCheck[] = [
      this.fileCheck("photoshop", "Photoshop estable", photoshop),
      this.fileCheck("camera-raw", "Adobe Camera Raw", cameraRaw),
      this.fileCheck("preset", "Preset seleccionado", preset),
      this.fileCheck("droplet", "Droplet de Photoshop", droplet),
      this.fileCheck("action", "Action de Photoshop", action),
      { id: "exchange", label: "Carpetas de intercambio", ready: exchange.ready, detail: exchange.detail },
      this.fileCheck("offline-resources", "Recursos para operar sin conexión", offlineResources),
    ]
    return {
      status: checks.every((check) => check.ready) ? "ready" : "unavailable",
      checkedAt: new Date().toISOString(),
      checks,
    }
  }

  private fileCheck(id: AdobeReadinessCheck["id"], label: string, value: string | null): AdobeReadinessCheck {
    return { id, label, ready: value !== null, detail: value ?? "No encontrado o no configurado" }
  }

  private async inspectExchange(directory: string): Promise<{ ready: boolean; detail: string }> {
    const directories = ["incoming", "outgoing", "quarantine"].map((name) => path.join(directory, name))
    const probe = path.join(directory, `.smartstudio-write-${process.pid}.tmp`)
    try {
      for (const item of directories) await mkdir(item, { recursive: true })
      await writeFile(probe, "ready", "utf8")
      await rm(probe, { force: true })
      return { ready: true, detail: directory }
    } catch (error) {
      await rm(probe, { force: true }).catch(() => undefined)
      return { ready: false, detail: error instanceof Error ? error.message : "La carpeta no es escribible" }
    }
  }
}
