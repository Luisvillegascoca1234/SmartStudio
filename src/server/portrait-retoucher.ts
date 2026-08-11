import path from "node:path"
import type { BackdropCompletion, RetouchOperation, RetouchOperationDecision, RetouchStageMilliseconds } from "../shared/workflow.js"
import { runLocalProcess, type LocalProcessDiagnostic } from "./local-process.js"

export type PortraitResult = {
  faces: number
  treated: number
  warnings: string[]
  backdrop: BackdropCompletion
  operations: Record<RetouchOperation, RetouchOperationDecision>
  stageMilliseconds: RetouchStageMilliseconds
}
export type PortraitFixture =
  | { kind: "single" }
  | { kind: "group"; faceCount: number }
  | { kind: "uncertain" }
  | { kind: "backdrop" }
  | { kind: "backdrop-uncertain-mask" }
  | { kind: "skin-uncertain" }
  | { kind: "partial-eyes" }
  | { kind: "no-teeth" }

export class PortraitRetoucher {
  constructor(
    private readonly modelDirectory = process.env.SMARTSTUDIO_MODEL_DIR ?? path.resolve(".smartstudio-data", "models"),
    private readonly pythonExecutable = process.env.SMARTSTUDIO_PYTHON ?? "python",
  ) {}

  async apply(source: string, destination: string, skinLevel: number, fixture?: PortraitFixture, signal?: AbortSignal, onDiagnostic?: (diagnostic: LocalProcessDiagnostic) => void): Promise<PortraitResult> {
    const script = path.resolve("scripts", "portrait-retouch.py")
    const controlledArgument = fixture?.kind === "single"
      ? "controlled"
      : fixture?.kind === "group"
        ? `controlled:${fixture.faceCount}`
        : fixture?.kind === "uncertain"
          ? "controlled:uncertain"
          : fixture?.kind === "backdrop"
            ? "controlled:backdrop"
            : fixture?.kind === "backdrop-uncertain-mask" ? "controlled:backdrop-uncertain-mask"
              : fixture?.kind === "skin-uncertain" ? "controlled:skin-uncertain"
                : fixture?.kind === "partial-eyes" ? "controlled:partial-eyes"
                  : fixture?.kind === "no-teeth" ? "controlled:no-teeth" : null
    const result = await runLocalProcess(this.pythonExecutable, [
      script,
      source,
      destination,
      String(Math.min(2, Math.max(0, skinLevel))),
      controlledArgument ?? "-",
      this.modelDirectory,
    ], { stage: "portrait-retouch", timeoutMilliseconds: 120_000, signal, onDiagnostic })
    if (result.termination === "cancelled") throw new Error("El retoque local fue cancelado.")
    if (result.termination === "timeout") throw new Error("El retoque local excedió 120 segundos y fue terminado; puedes reintentar.")
    if (result.code !== 0) throw new Error(`No se pudo aplicar el retoque facial local: ${result.stderr.trim()}`)
    return JSON.parse(result.stdout) as PortraitResult
  }
}
