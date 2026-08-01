export type CapacityLevel = "sufficient" | "low" | "critical"
export type BackupStatus = "not-configured" | "ready" | "copying" | "verified" | "error" | "disconnected"

export type OperationsSnapshot = {
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
