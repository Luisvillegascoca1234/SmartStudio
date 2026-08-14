import path from "node:path"
import type { BackdropCompletion, MatteProvenance, RetouchOperation, RetouchOperationDecision, RetouchStageMilliseconds } from "../shared/workflow.js"
import { runLocalProcess, type LocalProcessDiagnostic } from "./local-process.js"
import { VisionWorker } from "./vision-worker.js"

export type PortraitResult = {
  faces: number
  treated: number
  warnings: string[]
  backdrop: BackdropCompletion
  operations: Record<RetouchOperation, RetouchOperationDecision>
  stageMilliseconds: RetouchStageMilliseconds
  matte: MatteProvenance
}
export type PortraitFixture =
  | { kind: "single" }
  | { kind: "group"; faceCount: number }
  | { kind: "uncertain" }
  | { kind: "backdrop" }
  | { kind: "backdrop-soft-edge" }
  | { kind: "backdrop-uncertain-mask" }
  | { kind: "skin-uncertain" }
  | { kind: "partial-eyes" }
  | { kind: "no-teeth" }

export class PortraitRetoucher {
  private readonly worker: VisionWorker | null

  constructor(
    private readonly modelDirectory = process.env.SMARTSTUDIO_MODEL_DIR ?? path.resolve(".smartstudio-data", "models"),
    private readonly pythonExecutable = process.env.SMARTSTUDIO_PYTHON ?? "python",
    persistentWorker = false,
    matteProvider?: "mediapipe" | "birefnet",
    forceBirefnetCpu = false,
  ) {
    this.worker = persistentWorker ? new VisionWorker(this.modelDirectory, this.pythonExecutable, matteProvider, forceBirefnetCpu) : null
  }

  async apply(source: string, destination: string, skinLevel: number, fixture?: PortraitFixture, signal?: AbortSignal, onDiagnostic?: (diagnostic: LocalProcessDiagnostic) => void, cleanPlatePath?: string, matteProvider?: "mediapipe" | "birefnet"): Promise<PortraitResult> {
    if (this.worker) {
      const { result, diagnostic } = await this.worker.apply({ source, destination, skinLevel, fixture, cleanPlatePath, matteProvider }, signal)
      onDiagnostic?.(diagnostic)
      return result
    }
    const script = path.resolve("scripts", "portrait-retouch.py")
    const result = await runLocalProcess(this.pythonExecutable, [
      script,
      source,
      destination,
      String(Math.min(2, Math.max(0, skinLevel))),
      fixture ? JSON.stringify(fixture) : "-",
      this.modelDirectory,
      cleanPlatePath ?? "-",
      matteProvider ?? "-",
    ], { stage: "portrait-retouch", timeoutMilliseconds: 120_000, signal, onDiagnostic })
    if (result.termination === "cancelled") throw new Error("El retoque local fue cancelado.")
    if (result.termination === "timeout") throw new Error("El retoque local excedió 120 segundos y fue terminado; puedes reintentar.")
    if (result.code !== 0) throw new Error(`No se pudo aplicar el retoque facial local: ${result.stderr.trim()}`)
    return JSON.parse(result.stdout) as PortraitResult
  }

  async close(): Promise<void> {
    await this.worker?.close()
  }

  terminateWorkerForVerification(): void {
    this.worker?.terminateForVerification()
  }
}
