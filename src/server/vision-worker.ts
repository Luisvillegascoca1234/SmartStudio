import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process"
import { createInterface, type Interface } from "node:readline"
import path from "node:path"

import type { LocalProcessDiagnostic, LocalProcessTermination } from "./local-process.js"
import type { PortraitFixture, PortraitResult } from "./portrait-retoucher.js"

type VisionRequest = {
  source: string
  destination: string
  skinLevel: number
  fixture?: PortraitFixture
  cleanPlatePath?: string
  matteProvider?: "mediapipe" | "birefnet"
}

type PendingRequest = {
  resolve: (value: { result: PortraitResult; diagnostic: LocalProcessDiagnostic }) => void
  reject: (error: Error) => void
  startedAt: number
  timeout: NodeJS.Timeout
  cleanupAbort: () => void
}

export class VisionWorker {
  private child: ChildProcessWithoutNullStreams | null = null
  private reader: Interface | null = null
  private ready: Promise<void> | null = null
  private readyResolve: (() => void) | null = null
  private readyReject: ((error: Error) => void) | null = null
  private pending: { id: string; request: PendingRequest } | null = null
  private closing = false

  constructor(
    private readonly modelDirectory: string,
    private readonly pythonExecutable = process.env.SMARTSTUDIO_PYTHON ?? "python",
    private readonly matteProvider = process.env.SMARTSTUDIO_MATTE_PROVIDER,
    private readonly forceBirefnetCpu = process.env.SMARTSTUDIO_BIREFNET_FORCE_CPU === "1",
  ) {}

  async apply(request: VisionRequest, signal?: AbortSignal): Promise<{ result: PortraitResult; diagnostic: LocalProcessDiagnostic }> {
    if (this.pending) throw new Error("El trabajador de visión ya está atendiendo otra fotografía.")
    if (signal?.aborted) throw new Error("El retoque local fue cancelado.")
    await this.ensureReady()
    const child = this.child
    if (!child) throw new Error("El trabajador de visión no está disponible.")
    const id = crypto.randomUUID()
    return new Promise((resolve, reject) => {
      const startedAt = Date.now()
      const terminate = (termination: "timeout" | "cancelled") => {
        const diagnostic = this.diagnostic(startedAt, termination)
        this.failPending(new Error(termination === "timeout"
          ? "El retoque local excedió 120 segundos y fue terminado; puedes reintentar."
          : "El retoque local fue cancelado."))
        this.terminate()
        return diagnostic
      }
      const timeout = setTimeout(() => terminate("timeout"), 120_000)
      const onAbort = () => terminate("cancelled")
      signal?.addEventListener("abort", onAbort, { once: true })
      this.pending = {
        id,
        request: {
          resolve,
          reject,
          startedAt,
          timeout,
          cleanupAbort: () => signal?.removeEventListener("abort", onAbort),
        },
      }
      child.stdin.write(`${JSON.stringify({ id, ...request })}\n`)
    })
  }

  async close(): Promise<void> {
    this.closing = true
    this.failPending(new Error("El trabajador de visión se cerró."))
    this.terminate()
  }

  terminateForVerification(): void {
    this.terminate()
  }

  private async ensureReady(): Promise<void> {
    if (this.child && this.ready) return this.ready
    this.closing = false
    this.ready = new Promise<void>((resolve, reject) => {
      this.readyResolve = resolve
      this.readyReject = reject
    })
    const child = spawn(this.pythonExecutable, [path.resolve("scripts", "vision-worker.py"), this.modelDirectory], {
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        ...process.env,
        ...(this.matteProvider ? { SMARTSTUDIO_MATTE_PROVIDER: this.matteProvider } : {}),
        ...(this.forceBirefnetCpu ? { SMARTSTUDIO_BIREFNET_FORCE_CPU: "1" } : {}),
      },
    })
    this.child = child
    this.reader = createInterface({ input: child.stdout })
    this.reader.on("line", (line) => this.handleLine(line))
    child.once("error", (error) => this.handleExit(child, error))
    child.once("exit", (code) => this.handleExit(child, new Error(`El trabajador de visión terminó con código ${code ?? "desconocido"}.`)))
    const startupTimeout = setTimeout(() => this.handleExit(child, new Error("El trabajador de visión no terminó su preparación local.")), 30_000)
    try {
      await this.ready
    } finally {
      clearTimeout(startupTimeout)
    }
  }

  private handleLine(line: string): void {
    let message: { type?: string; id?: string; result?: PortraitResult; error?: string; durationMilliseconds?: number }
    try {
      message = JSON.parse(line) as typeof message
    } catch {
      return
    }
    if (message.type === "ready") {
      this.readyResolve?.()
      this.readyResolve = null
      this.readyReject = null
      return
    }
    if (!this.pending || message.id !== this.pending.id) return
    const pending = this.pending.request
    this.pending = null
    clearTimeout(pending.timeout)
    pending.cleanupAbort()
    if (message.type === "result" && message.result) {
      pending.resolve({ result: message.result, diagnostic: this.diagnostic(pending.startedAt, "completed") })
    } else {
      pending.reject(new Error(message.error || "El trabajador de visión no devolvió un resultado válido."))
    }
  }

  private handleExit(source: ChildProcessWithoutNullStreams, error: Error): void {
    if (this.child !== source) return
    this.readyReject?.(error)
    this.readyResolve = null
    this.readyReject = null
    this.failPending(error)
    this.reader?.close()
    this.reader = null
    this.child = null
    this.ready = null
  }

  private failPending(error: Error): void {
    if (!this.pending) return
    const pending = this.pending.request
    this.pending = null
    clearTimeout(pending.timeout)
    pending.cleanupAbort()
    pending.reject(error)
  }

  private terminate(): void {
    const child = this.child
    this.reader?.close()
    this.reader = null
    this.child = null
    this.ready = null
    if (child && !child.killed) child.kill("SIGKILL")
  }

  private diagnostic(startedAt: number, termination: LocalProcessTermination): LocalProcessDiagnostic {
    return {
      stage: "portrait-retouch",
      durationMilliseconds: Date.now() - startedAt,
      code: termination === "completed" ? 0 : null,
      termination,
      outputTruncated: false,
    }
  }
}
