import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { expect, test } from "@playwright/test"
import sharp from "sharp"

import { ensureEventPolishedRecipe } from "../../src/server/event-polished-recipe.js"
import { sha256File } from "../../src/server/file-hash.js"
import { RawDeveloper } from "../../src/server/raw-developer.js"
import type { LocalProcessDiagnostic } from "../../src/server/local-process.js"

const authorizedRawPath = process.env.SMARTSTUDIO_AUTHORIZED_RAW

test("darktable aplica la receta explícita y publica un TIFF de 16 bits con un RAW autorizado", async () => {
  test.skip(!authorizedRawPath, "Define SMARTSTUDIO_AUTHORIZED_RAW con un RAW autorizado fuera de Git.")
  const rawPath = path.resolve(authorizedRawPath!)
  const dataDirectory = path.dirname(rawPath)
  const outputDirectory = await mkdtemp(path.join(tmpdir(), "smartstudio-darktable-real-"))
  const jpegPath = path.join(outputDirectory, "association.jpg")
  const masterPath = path.join(outputDirectory, "master.tif")
  try {
    await sharp({ create: { width: 16, height: 16, channels: 3, background: "#808080" } }).jpeg().toFile(jpegPath)
    const originalHash = await sha256File(rawPath)
    const recipe = await ensureEventPolishedRecipe(dataDirectory)
    const diagnostics: LocalProcessDiagnostic[] = []
    const result = await new RawDeveloper(dataDirectory).develop(path.basename(rawPath), jpegPath, recipe.path, masterPath, undefined, (diagnostic) => diagnostics.push(diagnostic))
    expect(result.method, JSON.stringify(diagnostics)).toBe("darktable")
    expect(result.developerVersion).toContain("darktable")
    expect(await sharp(masterPath).metadata()).toMatchObject({ format: "tiff", channels: 3, depth: "ushort" })
    expect(await sha256File(rawPath)).toBe(originalHash)
    expect(diagnostics).toEqual(expect.arrayContaining([expect.objectContaining({ stage: "darktable-development", termination: "completed", code: 0 })]))
  } finally {
    await rm(outputDirectory, { recursive: true, force: true })
  }
})

test("rawpy conserva el máster de 16 bits y declara su diferencia cuando darktable no está disponible", async () => {
  test.skip(!authorizedRawPath, "Define SMARTSTUDIO_AUTHORIZED_RAW con un RAW autorizado fuera de Git.")
  const rawPath = path.resolve(authorizedRawPath!)
  const dataDirectory = path.dirname(rawPath)
  const outputDirectory = await mkdtemp(path.join(tmpdir(), "smartstudio-rawpy-real-"))
  const jpegPath = path.join(outputDirectory, "association.jpg")
  const masterPath = path.join(outputDirectory, "master.tif")
  const previous = process.env.SMARTSTUDIO_DARKTABLE_DISABLE
  try {
    process.env.SMARTSTUDIO_DARKTABLE_DISABLE = "1"
    await sharp({ create: { width: 16, height: 16, channels: 3, background: "#808080" } }).jpeg().toFile(jpegPath)
    const recipe = await ensureEventPolishedRecipe(dataDirectory)
    const result = await new RawDeveloper(dataDirectory).develop(path.basename(rawPath), jpegPath, recipe.path, masterPath)
    expect(result.method).toBe("rawpy")
    expect(result.developerVersion).toContain("rawpy")
    expect(result.parameters).toMatchObject({ output_bps: 16, output_color: "sRGB" })
    expect(result.warnings).toEqual(expect.arrayContaining([expect.stringContaining("diferir")]))
    expect(await sharp(masterPath).metadata()).toMatchObject({ format: "tiff", channels: 3, depth: "ushort" })
  } finally {
    if (previous === undefined) delete process.env.SMARTSTUDIO_DARKTABLE_DISABLE
    else process.env.SMARTSTUDIO_DARKTABLE_DISABLE = previous
    await rm(outputDirectory, { recursive: true, force: true })
  }
})
