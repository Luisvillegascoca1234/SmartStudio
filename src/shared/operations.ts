export type CapacityLevel = "sufficient" | "low" | "critical"
export type BackupStatus = "not-configured" | "ready" | "copying" | "verified" | "error" | "disconnected"

export type AdobeReadinessCheck = {
  id: "photoshop" | "camera-raw" | "preset" | "droplet" | "action" | "exchange" | "offline-resources"
  label: string
  ready: boolean
  detail: string
}

export type AdobeReadiness = {
  status: "ready" | "unavailable"
  checkedAt: string
  checks: AdobeReadinessCheck[]
}

export type OperationsSnapshot = {
  adobe: AdobeReadiness
  captureSource: {
    status: "ready" | "unavailable"
    label: string
    configured: boolean
    cameraCardRequired: true
  }
  internalStorage: {
    level: CapacityLevel
    freeBytes: number
  }
  backup: {
    directory: string | null
    connected: boolean
    status: BackupStatus
    verifiedFiles: number
    lastVerifiedAt: string | null
    error: string | null
  }
  power: {
    status: "ac" | "battery" | "unknown"
    label: string
  }
  soundAlertsEnabled: boolean
  blocksNewSession: boolean
}
