import path from "node:path"
import type { AdaptiveToneDiagnostics, BackdropCompletion, BackdropDiagnostics } from "../shared/workflow.js"
import { runLocalProcess } from "./local-process.js"

export type PortraitResult = {
  faces: number
  treated: number
  eyesEnhanced: boolean
  teethWhitened: boolean
  warnings: string[]
  backdrop: BackdropCompletion
  backdropDiagnostics: BackdropDiagnostics | null
  adaptiveTone?: AdaptiveToneDiagnostics | null
}
export type PortraitFixture =
  | { kind: "single" }
  | { kind: "group"; faceCount: number }
  | { kind: "uncertain" }
  | { kind: "backdrop" }
  | { kind: "backdrop-uncertain-mask" }

export class PortraitRetoucher {
  constructor(
    private readonly modelDirectory = process.env.SMARTSTUDIO_MODEL_DIR ?? path.resolve(".smartstudio-data", "models"),
    private readonly pythonExecutable = process.env.SMARTSTUDIO_PYTHON ?? (process.platform === "win32" ? "py" : "python3"),
  ) {}

  async apply(
    source: string,
    destination: string,
    skinLevel: number,
    fixture?: PortraitFixture,
    completeBackdrop = fixture?.kind === "backdrop" || fixture?.kind === "backdrop-uncertain-mask",
  ): Promise<PortraitResult> {
    const script = path.resolve("scripts", "portrait-retouch.py")
    const controlledArgument = fixture?.kind === "single"
      ? "controlled"
      : fixture?.kind === "group"
        ? `controlled:${fixture.faceCount}`
        : fixture?.kind === "uncertain"
          ? "controlled:uncertain"
          : fixture?.kind === "backdrop"
            ? "controlled:backdrop"
            : fixture?.kind === "backdrop-uncertain-mask" ? "controlled:backdrop-uncertain-mask" : null
    const result = await runLocalProcess(this.pythonExecutable, [
      script,
      source,
      destination,
      String(Math.min(2, Math.max(0, skinLevel))),
      controlledArgument ?? "-",
      this.modelDirectory,
      completeBackdrop ? "backdrop" : "natural",
    ])
    if (result.code !== 0) throw new Error(`No se pudo aplicar el retoque facial local: ${result.stderr.trim()}`)
    const parsed = JSON.parse(result.stdout) as Partial<PortraitResult>
    return {
      faces: parsed.faces ?? 0,
      treated: parsed.treated ?? 0,
      eyesEnhanced: parsed.eyesEnhanced === true,
      teethWhitened: parsed.teethWhitened === true,
      warnings: parsed.warnings ?? [],
      backdrop: parsed.backdrop ?? "unchanged",
      backdropDiagnostics: parsed.backdropDiagnostics ?? null,
      adaptiveTone: parsed.adaptiveTone ?? null,
    }
  }
}
