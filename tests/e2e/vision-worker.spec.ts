import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { expect, test } from "@playwright/test"
import sharp from "sharp"

import type { LocalProcessDiagnostic } from "../../src/server/local-process.js"
import { PortraitRetoucher } from "../../src/server/portrait-retoucher.js"

test("reutiliza la sesión caliente y se recupera después de terminar el trabajador", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "smartstudio-vision-worker-"))
  const retoucher = new PortraitRetoucher(path.resolve(".smartstudio-data", "models"), process.env.SMARTSTUDIO_PYTHON ?? "python", true)
  try {
    const source = path.join(directory, "source.png")
    await sharp({ create: { width: 900, height: 600, channels: 3, background: "#718a91" } }).png().toFile(source)
    const diagnostics: LocalProcessDiagnostic[] = []
    const first = await retoucher.apply(source, path.join(directory, "first.tif"), 0, { kind: "backdrop" }, undefined, (diagnostic) => diagnostics.push(diagnostic))
    const second = await retoucher.apply(source, path.join(directory, "second.tif"), 0, { kind: "backdrop" }, undefined, (diagnostic) => diagnostics.push(diagnostic))
    expect(first.matte.sessionReused).toBe(false)
    expect(second.matte.sessionReused).toBe(true)
    expect(first.matte.warmupMilliseconds).toBeGreaterThanOrEqual(0)
    expect(diagnostics).toHaveLength(2)
    expect(diagnostics.every((diagnostic) => diagnostic.termination === "completed")).toBe(true)

    retoucher.terminateWorkerForVerification()
    const recovered = await retoucher.apply(source, path.join(directory, "recovered.tif"), 0, { kind: "backdrop" })
    expect(recovered.matte.sessionReused).toBe(false)
  } finally {
    await retoucher.close()
    await rm(directory, { recursive: true, force: true })
  }
})
