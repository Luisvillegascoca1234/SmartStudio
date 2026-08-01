import { useEffect, useRef, useState } from "react"

import type { OperationsSnapshot } from "../shared/operations.js"

const REFRESH_INTERVAL_MILLISECONDS = 2_000
const ALERT_FREQUENCY_HERTZ = 740
const ALERT_DURATION_SECONDS = 0.18

export function useOperations(reportError: (message: string) => void) {
  const [operations, setOperations] = useState<OperationsSnapshot | null>(null)
  const [busy, setBusy] = useState(false)
  const lastAlert = useRef<string | null>(null)

  useEffect(() => {
    const refresh = () => fetch("/api/operations")
      .then(async (response) => (await response.json()) as OperationsSnapshot)
      .then(setOperations)
      .catch(() => undefined)
    void refresh()
    const interval = window.setInterval(refresh, REFRESH_INTERVAL_MILLISECONDS)
    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    const alertKey = operations?.backup.status === "error" || operations?.backup.status === "disconnected"
      ? `${operations.backup.status}:${operations.backup.error}`
      : operations?.blocksNewSession
        ? "critical-storage"
        : null
    if (!alertKey || alertKey === lastAlert.current || !operations?.soundAlertsEnabled) return
    lastAlert.current = alertKey
    const context = new window.AudioContext()
    void context.resume().then(() => {
      const oscillator = context.createOscillator()
      oscillator.frequency.value = ALERT_FREQUENCY_HERTZ
      oscillator.connect(context.destination)
      oscillator.start()
      oscillator.stop(context.currentTime + ALERT_DURATION_SECONDS)
      oscillator.addEventListener("ended", () => void context.close())
    }).catch(() => void context.close())
  }, [operations])

  const execute = async (path: string, body: unknown) => {
    setBusy(true)
    try {
      const response = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const result = (await response.json()) as OperationsSnapshot | { error: string }
      if (!response.ok) throw new Error("error" in result ? result.error : "No se pudo actualizar la verificación.")
      setOperations(result as OperationsSnapshot)
    } catch (caught) {
      reportError(caught instanceof Error ? caught.message : "No se pudo actualizar la verificación.")
    } finally {
      setBusy(false)
    }
  }

  return {
    operations,
    busy,
    configureBackup: (directory: string) => execute("/api/operations/backup", { directory }),
    configureSonySource: (directory: string) => execute("/api/sony-source", { directory }),
    setSoundAlerts: (enabled: boolean) => execute("/api/operations/sound", { enabled }),
  }
}
