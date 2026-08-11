import { spawn } from "node:child_process"

export type LocalProcessTermination = "completed" | "failed" | "timeout" | "cancelled" | "spawn-error"

export type LocalProcessDiagnostic = {
  stage: string
  durationMilliseconds: number
  code: number | null
  termination: LocalProcessTermination
  outputTruncated: boolean
}

export type LocalProcessResult = LocalProcessDiagnostic & {
  stdout: string
  stderr: string
}

export type LocalProcessOptions = {
  stage: string
  timeoutMilliseconds: number
  signal?: AbortSignal
  maximumOutputBytes?: number
  onDiagnostic?: (diagnostic: LocalProcessDiagnostic) => void
}

const appendBounded = (current: Buffer, chunk: Buffer, maximumBytes: number): { value: Buffer; truncated: boolean } => {
  const available = maximumBytes - current.length
  if (available <= 0) return { value: current, truncated: chunk.length > 0 }
  return {
    value: Buffer.concat([current, chunk.subarray(0, available)]),
    truncated: chunk.length > available,
  }
}

const terminateTree = (pid: number): void => {
  if (process.platform === "win32") {
    const killer = spawn("taskkill.exe", ["/PID", String(pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" })
    killer.unref()
    return
  }
  try {
    process.kill(-pid, "SIGKILL")
  } catch {
    try { process.kill(pid, "SIGKILL") } catch { /* El proceso ya terminó. */ }
  }
}

export const runLocalProcess = (
  executable: string,
  arguments_: string[],
  options: LocalProcessOptions,
): Promise<LocalProcessResult> => new Promise((resolve) => {
  const startedAt = Date.now()
  const maximumOutputBytes = options.maximumOutputBytes ?? 64 * 1024
  let stdout: Buffer<ArrayBufferLike> = Buffer.alloc(0)
  let stderr: Buffer<ArrayBufferLike> = Buffer.alloc(0)
  let outputTruncated = false
  let requestedTermination: "timeout" | "cancelled" | null = options.signal?.aborted ? "cancelled" : null
  let spawnError = false
  let settled = false

  if (requestedTermination) {
    const diagnostic: LocalProcessDiagnostic = {
      stage: options.stage,
      durationMilliseconds: 0,
      code: null,
      termination: requestedTermination,
      outputTruncated: false,
    }
    options.onDiagnostic?.(diagnostic)
    resolve({ ...diagnostic, stdout: "", stderr: "" })
    return
  }

  const child = spawn(executable, arguments_, {
    windowsHide: true,
    detached: process.platform !== "win32",
  })
  const requestTermination = (cause: "timeout" | "cancelled") => {
    if (settled || requestedTermination) return
    requestedTermination = cause
    if (child.pid) terminateTree(child.pid)
  }
  const timeout = setTimeout(() => requestTermination("timeout"), options.timeoutMilliseconds)
  timeout.unref()
  const abort = () => requestTermination("cancelled")
  options.signal?.addEventListener("abort", abort, { once: true })

  child.stdout.on("data", (chunk: Buffer) => {
    const next = appendBounded(stdout, chunk, maximumOutputBytes)
    stdout = next.value
    outputTruncated ||= next.truncated
  })
  child.stderr.on("data", (chunk: Buffer) => {
    const next = appendBounded(stderr, chunk, maximumOutputBytes)
    stderr = next.value
    outputTruncated ||= next.truncated
  })
  child.once("error", (error) => {
    spawnError = true
    stderr = Buffer.from(error.message).subarray(0, maximumOutputBytes)
  })
  child.once("close", (code) => {
    settled = true
    clearTimeout(timeout)
    options.signal?.removeEventListener("abort", abort)
    const termination: LocalProcessTermination = requestedTermination ?? (spawnError ? "spawn-error" : code === 0 ? "completed" : "failed")
    const diagnostic: LocalProcessDiagnostic = {
      stage: options.stage,
      durationMilliseconds: Date.now() - startedAt,
      code,
      termination,
      outputTruncated,
    }
    options.onDiagnostic?.(diagnostic)
    resolve({ ...diagnostic, stdout: stdout.toString("utf8"), stderr: stderr.toString("utf8") })
  })
})
