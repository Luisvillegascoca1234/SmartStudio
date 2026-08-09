import path from "node:path"

import { runLocalProcess } from "./local-process.js"

export type PhotoshopGpuStatus = {
  available: boolean
  enabled: boolean
  device: string | null
  error: string | null
}

const unavailableStatus = (error: string): PhotoshopGpuStatus => ({
  available: false,
  enabled: false,
  device: null,
  error,
})

export const parsePhotoshopGpuStatus = (value: string): PhotoshopGpuStatus => {
  try {
    const parsed = JSON.parse(value.trim()) as Partial<PhotoshopGpuStatus>
    return {
      available: parsed.available === true,
      enabled: parsed.available === true && parsed.enabled === true,
      device: typeof parsed.device === "string" && parsed.device.trim() ? parsed.device.trim() : null,
      error: typeof parsed.error === "string" && parsed.error.trim() ? parsed.error.trim() : null,
    }
  } catch {
    return unavailableStatus("Photoshop no devolvió un diagnóstico GPU válido.")
  }
}

export const detectPhotoshopGpu = async (): Promise<PhotoshopGpuStatus> => {
  if (process.platform !== "win32") return unavailableStatus("La detección automática de Photoshop GPU solo está disponible en Windows.")
  try {
    const probe = await runLocalProcess("powershell.exe", [
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      path.resolve("scripts", "photoshop-gpu-status.ps1"),
    ], 15_000)
    if (probe.code !== 0) return unavailableStatus(probe.stderr.trim() || `La detección GPU terminó con código ${probe.code}.`)
    return parsePhotoshopGpuStatus(probe.stdout)
  } catch (error) {
    return unavailableStatus(error instanceof Error ? error.message : String(error))
  }
}
