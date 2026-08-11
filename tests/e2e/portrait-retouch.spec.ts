import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { expect, test } from "@playwright/test"
import sharp from "sharp"

import { PortraitRetoucher } from "../../src/server/portrait-retoucher.js"
import { TestApplication } from "./support/test-application.js"

const sampleRgb = async (image: Buffer, xRatio: number, yRatio: number): Promise<number[]> => {
  const { data, info } = await sharp(image).removeAlpha().toColourspace("srgb").raw({ depth: "uchar" }).toBuffer({ resolveWithObject: true })
  const x = Math.min(info.width - 1, Math.round(info.width * xRatio))
  const y = Math.min(info.height - 1, Math.round(info.height * yRatio))
  const offset = (y * info.width + x) * 3
  return [...data.subarray(offset, offset + 3)]
}

const colorDistance = (first: number[], second: number[]): number =>
  Math.sqrt(first.reduce((sum, channel, index) => sum + (channel - second[index]) ** 2, 0))

const meanAbsoluteDifference = (first: Buffer, second: Buffer): number => {
  let total = 0
  for (let index = 0; index < first.length; index += 1) total += Math.abs(first[index] - second[index])
  return total / first.length
}

const darkGeometry = async (image: Buffer, area: { left: number; top: number; width: number; height: number }) => {
  const { data, info } = await sharp(image).extract(area).removeAlpha().toColourspace("srgb").raw({ depth: "uchar" }).toBuffer({ resolveWithObject: true })
  let count = 0
  let xTotal = 0
  let yTotal = 0
  let minX = info.width
  let minY = info.height
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < info.height; y += 1) for (let x = 0; x < info.width; x += 1) {
    const offset = (y * info.width + x) * 3
    if (data[offset] + data[offset + 1] + data[offset + 2] > 180) continue
    count += 1
    xTotal += x
    yTotal += y
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, y)
  }
  return { centroid: [xTotal / count, yTotal / count] as const, bounds: [minX, minY, maxX, maxY] as const, count }
}

test("hace visible el pulido de piel, conserva detalle y omite sólo una máscara incierta", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "smartstudio-skin-visible-"))
  try {
    const source = path.join(directory, "skin.png")
    const polished = path.join(directory, "polished.tif")
    const repeated = path.join(directory, "repeated.tif")
    const uncertain = path.join(directory, "uncertain.tif")
    const pixels = Buffer.alloc(600 * 500 * 3)
    for (let index = 0; index < pixels.length; index += 3) {
      const variation = ((index / 3 * 37) % 25) - 12
      pixels[index] = 88 + variation
      pixels[index + 1] = 109 + variation
      pixels[index + 2] = 169 + variation
    }
    const noise = await sharp(pixels, { raw: { width: 600, height: 500, channels: 3 } }).png().toBuffer()
    await sharp(noise).composite([{ input: Buffer.from(`<svg width="600" height="500" xmlns="http://www.w3.org/2000/svg"><rect x="400" y="300" width="160" height="180" rx="35" fill="#243342"/><circle cx="448" cy="133" r="10" fill="#321b17"/><circle cx="520" cy="133" r="10" fill="#321b17"/><circle cx="485" cy="202" r="7" fill="#4b2520"/></svg>`) }]).png().toFile(source)
    const retoucher = new PortraitRetoucher()
    const result = await retoucher.apply(source, polished, 2, { kind: "single" })
    const again = await retoucher.apply(source, repeated, 2, { kind: "single" })
    const uncertainResult = await retoucher.apply(source, uncertain, 2, { kind: "skin-uncertain" })
    const [before, after] = await Promise.all([
      sharp(source).extract({ left: 370, top: 35, width: 220, height: 260 }).removeAlpha().raw().toBuffer(),
      sharp(polished).extract({ left: 370, top: 35, width: 220, height: 260 }).removeAlpha().raw().toBuffer(),
    ])
    expect(result.operations.skin).toMatchObject({ status: "applied", regions: 1, omittedRegions: 0 })
    expect(meanAbsoluteDifference(before, after)).toBeGreaterThan(1.5)
    expect((await sharp(polished).stats()).channels[0].stdev).toBeGreaterThan((await sharp(source).stats()).channels[0].stdev * .35)
    const [moleBefore, skinBefore, moleAfter, skinAfter] = await Promise.all([
      sampleRgb(await readFile(source), 485 / 600, 202 / 500), sampleRgb(await readFile(source), 465 / 600, 202 / 500),
      sampleRgb(await readFile(polished), 485 / 600, 202 / 500), sampleRgb(await readFile(polished), 465 / 600, 202 / 500),
    ])
    expect(colorDistance(moleAfter, skinAfter)).toBeGreaterThan(colorDistance(moleBefore, skinBefore) * .65)
    const sourceFile = await readFile(source)
    const polishedFile = await readFile(polished)
    const [eyeBefore, eyeAfter, irisBefore, irisAfter, bodyBefore, bodyAfter] = await Promise.all([
      darkGeometry(sourceFile, { left: 430, top: 115, width: 38, height: 38 }),
      darkGeometry(polishedFile, { left: 430, top: 115, width: 38, height: 38 }),
      sampleRgb(sourceFile, 448 / 600, 133 / 500), sampleRgb(polishedFile, 448 / 600, 133 / 500),
      sampleRgb(sourceFile, 450 / 600, 400 / 500), sampleRgb(polishedFile, 450 / 600, 400 / 500),
    ])
    expect(Math.hypot(eyeAfter.centroid[0] - eyeBefore.centroid[0], eyeAfter.centroid[1] - eyeBefore.centroid[1])).toBeLessThan(.75)
    expect(eyeAfter.bounds).toEqual(eyeBefore.bounds)
    expect(eyeAfter.count / eyeBefore.count).toBeGreaterThan(.9)
    expect(eyeAfter.count / eyeBefore.count).toBeLessThan(1.1)
    const chroma = (rgb: number[]) => rgb.map((channel) => channel / Math.max(1, rgb.reduce((sum, value) => sum + value, 0)))
    expect(colorDistance(chroma(skinBefore), chroma(skinAfter))).toBeLessThan(.08)
    expect(colorDistance(chroma(irisBefore), chroma(irisAfter))).toBeLessThan(.08)
    expect(bodyAfter).toEqual(bodyBefore)
    expect(uncertainResult.operations).toMatchObject({
      skin: { status: "omitted", regions: 0, omittedRegions: 1 },
      eyes: { status: "applied" }, teeth: { status: "applied" }, facialLighting: { status: "applied" },
    })
    expect(again.operations).toEqual(result.operations)
    expect(await readFile(repeated)).toEqual(await readFile(polished))
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test("omite ojos o dientes inciertos sin bloquear las demás operaciones seguras", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "smartstudio-selective-regions-"))
  try {
    const source = path.join(directory, "portrait.png")
    await sharp({ create: { width: 600, height: 500, channels: 3, background: "#a96d58" } }).png().toFile(source)
    const retoucher = new PortraitRetoucher()
    const partialEyes = await retoucher.apply(source, path.join(directory, "partial-eyes.tif"), 2, { kind: "partial-eyes" })
    const noTeeth = await retoucher.apply(source, path.join(directory, "no-teeth.tif"), 2, { kind: "no-teeth" })
    expect(partialEyes.operations.eyes.status).toBe("omitted")
    expect(partialEyes.operations.skin.status).toBe("applied")
    expect(partialEyes.operations.teeth.status).toBe("applied")
    expect(noTeeth.operations.teeth.status).toBe("omitted")
    expect(noTeeth.operations.eyes.status).toBe("applied")
    expect(noTeeth.warnings).toEqual(expect.arrayContaining([expect.stringContaining("dientes con confianza")]))
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test("trata localmente rostros grupales diversos sin modificar geometría ni el fondo", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "smartstudio-portrait-group-"))
  try {
    const source = path.join(directory, "group.png")
    const destination = path.join(directory, "treated.png")
    const skin = ["#f0c39d", "#b97852", "#6f402e"]
    const faces = skin.map((color, index) => {
      const x = 36 + index * 292
      return `<rect x="${x}" y="90" width="243" height="330" rx="100" fill="${color}"/><circle cx="${x + 75}" cy="200" r="15" fill="#d82020"/><circle cx="${x + 168}" cy="200" r="15" fill="#4b332a"/><rect x="${x + 80}" y="335" width="85" height="25" rx="8" fill="#e7d38a"/>`
    }).join("")
    await sharp(Buffer.from(`<svg width="900" height="600" xmlns="http://www.w3.org/2000/svg"><rect width="900" height="600" fill="#24404d"/>${faces}</svg>`)).png().toFile(source)
    const before = await sharp(source).removeAlpha().raw().toBuffer({ resolveWithObject: true })
    const result = await new PortraitRetoucher().apply(source, destination, 1, { kind: "group", faceCount: 3 })
    const after = await sharp(destination).removeAlpha().raw().toBuffer({ resolveWithObject: true })
    expect(result).toMatchObject({ faces: 3, treated: 3, warnings: [] })
    expect(after.info.width).toBe(before.info.width)
    expect(after.info.height).toBe(before.info.height)
    expect(after.data.subarray(0, 3)).toEqual(before.data.subarray(0, 3))
    expect(after.data.equals(before.data)).toBe(false)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test("omite el retoque cuando no detecta rostros y conserva el archivo", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "smartstudio-portrait-none-"))
  try {
    const source = path.join(directory, "none.png")
    const destination = path.join(directory, "treated.png")
    await sharp({ create: { width: 500, height: 300, channels: 3, background: "#24404d" } }).png().toFile(source)
    const result = await new PortraitRetoucher().apply(source, destination, 2)
    expect(result.faces).toBe(0)
    expect(result.warnings).toEqual(expect.arrayContaining([expect.stringContaining("No se detectaron rostros")]))
    expect(await readFile(destination)).toEqual(await readFile(source))
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test("advierte y omite ojos y dientes cuando la detección controlada es incierta", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "smartstudio-portrait-uncertain-"))
  try {
    const source = path.join(directory, "uncertain.png")
    const destination = path.join(directory, "treated.jpg")
    await sharp({ create: { width: 600, height: 500, channels: 3, background: "#87624f" } }).png().toFile(source)
    const result = await new PortraitRetoucher().apply(source, destination, 1, { kind: "uncertain" })
    expect(result.faces).toBe(1)
    expect(result.warnings).toEqual(expect.arrayContaining([
      expect.stringContaining("ojos con confianza"),
      expect.stringContaining("dientes con confianza"),
    ]))
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test("completa un fondo uniforme interrumpido sin modificar la persona protegida", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "smartstudio-backdrop-complete-"))
  try {
    const source = path.join(directory, "incomplete.png")
    const destination = path.join(directory, "completed.png")
    const svg = `<svg width="900" height="600" xmlns="http://www.w3.org/2000/svg">
      <rect width="900" height="600" fill="#6f9ca8"/>
      <path d="M0 0H900V165L0 235Z" fill="#777b80"/>
      <rect x="35" y="125" width="42" height="105" rx="12" fill="#111111"/>
      <rect x="820" y="115" width="38" height="115" rx="12" fill="#111111"/>
      <ellipse cx="450" cy="350" rx="135" ry="215" fill="#b97852"/>
    </svg>`
    await sharp(Buffer.from(svg)).png().toFile(source)
    const before = await sharp(source).removeAlpha().raw().toBuffer({ resolveWithObject: true })
    const result = await new PortraitRetoucher().apply(source, destination, 0, { kind: "backdrop" })
    const after = await sharp(destination).removeAlpha().raw().toBuffer({ resolveWithObject: true })
    const pixel = (data: Buffer, x: number, y: number) => data.subarray((y * 900 + x) * 3, (y * 900 + x) * 3 + 3)
    expect(result.backdrop).toBe("completed")
    expect(pixel(after.data, 100, 80)).not.toEqual(pixel(before.data, 100, 80))
    expect(pixel(after.data, 450, 350)).toEqual(pixel(before.data, 450, 350))
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test("omite el completado cuando el fondo no es uniforme", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "smartstudio-backdrop-uncertain-"))
  try {
    const source = path.join(directory, "complex.png")
    const destination = path.join(directory, "unchanged.png")
    const tiles = Array.from({ length: 12 }, (_, y) => Array.from({ length: 18 }, (_, x) =>
      `<rect x="${x * 50}" y="${y * 50}" width="50" height="50" fill="${(x + y) % 2 ? "#f1d34f" : "#254a9f"}"/>`,
    ).join("")).join("")
    await sharp(Buffer.from(`<svg width="900" height="600" xmlns="http://www.w3.org/2000/svg">${tiles}<ellipse cx="450" cy="350" rx="135" ry="215" fill="#b97852"/></svg>`)).png().toFile(source)
    const result = await new PortraitRetoucher().apply(source, destination, 0, { kind: "backdrop" })
    expect(result.backdrop).toBe("omitted")
    expect(result.warnings).toEqual(expect.arrayContaining([expect.stringContaining("uniforme")]))
    expect(await readFile(destination)).toEqual(await readFile(source))
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test("conserva el fondo cuando la máscara de persona es incierta", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "smartstudio-backdrop-mask-"))
  try {
    const source = path.join(directory, "mask-uncertain.png")
    const destination = path.join(directory, "unchanged.png")
    await sharp({ create: { width: 900, height: 600, channels: 3, background: "#6f9ca8" } })
      .composite([{ input: Buffer.from(`<svg width="900" height="600" xmlns="http://www.w3.org/2000/svg"><ellipse cx="450" cy="350" rx="135" ry="215" fill="#b97852"/></svg>`) }])
      .png()
      .toFile(source)
    const result = await new PortraitRetoucher().apply(source, destination, 0, { kind: "backdrop-uncertain-mask" })
    expect(result.backdrop).toBe("omitted")
    expect(result.warnings).toEqual(expect.arrayContaining([expect.stringContaining("máscara")]))
    expect(await readFile(destination)).toEqual(await readFile(source))
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test("no confunde una pared dominante con el fondo uniforme minoritario", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "smartstudio-backdrop-ambiguous-"))
  try {
    const source = path.join(directory, "ambiguous.png")
    const destination = path.join(directory, "unchanged.png")
    const svg = `<svg width="900" height="600" xmlns="http://www.w3.org/2000/svg">
      <rect width="900" height="600" fill="#777b80"/>
      <rect x="300" y="250" width="300" height="350" fill="#6f9ca8"/>
      <ellipse cx="450" cy="350" rx="135" ry="215" fill="#b97852"/>
    </svg>`
    await sharp(Buffer.from(svg)).png().toFile(source)
    const result = await new PortraitRetoucher().apply(source, destination, 0, { kind: "backdrop" })
    expect(result.backdrop).toBe("omitted")
    expect(result.warnings).toEqual(expect.arrayContaining([expect.stringContaining("confianza")]))
    expect(await readFile(destination)).toEqual(await readFile(source))
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test("mantiene el completado en la vista previa y el JPEG completo aprobado", async ({ browser }) => {
  const application = await TestApplication.start(browser, "smartstudio-backdrop-flow-", {
    testFeatures: true,
    controlledPortraitFixture: { kind: "backdrop" },
    simulatedCaptureProfile: "backdrop",
  })
  try {
    await application.page.getByLabel("Nombre del evento").fill("Fondo controlado")
    await application.page.getByRole("button", { name: "Crear evento" }).click()
    await application.page.getByRole("button", { name: "Iniciar sesión fotográfica" }).click()
    await application.page.getByRole("button", { name: "Iniciar serie" }).click()
    await application.page.getByRole("button", { name: "Simular captura RAW + JPEG" }).click()
    await expect(application.page.getByText("RAW + JPEG asociados", { exact: false })).toBeVisible()
    let state = await application.state()
    const capture = state.events[0].sessions[0].series[0].captures[0]
    const original = await application.readDataFile(capture.jpegRelativePath!)
    await application.page.getByRole("button", { name: "Cerrar serie" }).click()
    await application.page.getByRole("button", { name: "Seleccionar", exact: true }).click()
    await application.page.getByRole("button", { name: "Marcar principal" }).click()
    await application.page.getByRole("button", { name: "Finalizar sesión fotográfica" }).click()
    const card = application.page.getByTestId(`editing-job-${capture.baseName}`)
    await expect(card.getByText("Fondo: completado", { exact: true })).toBeVisible()
    state = await application.state()
    expect(state.editingJobs[0].backdropCompletion).toBe("completed")
    const preview = await application.readDataFile(state.editingJobs[0].previewRelativePath!)

    await card.getByRole("button", { name: "Aprobar edición" }).click()
    await expect(card.getByText("Edición aprobada y lista para entrega", { exact: true })).toBeVisible()
    state = await application.state()
    const deliveryPath = state.editingJobs[0].versions[0].fullRelativePath
    expect(deliveryPath).not.toBeNull()
    const delivery = await application.readDataFile(deliveryPath!)
    const [originalTop, previewTop, deliveryTop] = await Promise.all([
      sampleRgb(original, .12, .1),
      sampleRgb(preview, .12, .1),
      sampleRgb(delivery, .12, .1),
    ])
    expect(colorDistance(originalTop, previewTop)).toBeGreaterThan(12)
    expect(colorDistance(previewTop, deliveryTop)).toBeLessThan(12)
    await application.reopen()
    expect((await application.state()).editingJobs[0].backdropCompletion).toBe("completed")
  } finally {
    await application.close()
  }
})

test("expone el análisis facial automático sin ajustes de operador", async ({ browser }) => {
  const application = await TestApplication.start(browser, "smartstudio-portrait-ui-", { testFeatures: true })
  try {
    await application.page.getByLabel("Nombre del evento").fill("Retrato")
    await application.page.getByRole("button", { name: "Crear evento" }).click()
    await application.page.getByRole("button", { name: "Iniciar sesión fotográfica" }).click()
    await application.page.getByRole("button", { name: "Iniciar serie" }).click()
    await application.page.getByRole("button", { name: "Simular captura RAW + JPEG" }).click()
    await expect(application.page.getByText("RAW + JPEG asociados", { exact: false })).toBeVisible()
    await application.page.getByRole("button", { name: "Cerrar serie" }).click()
    await application.page.getByRole("button", { name: "Seleccionar", exact: true }).click()
    await application.page.getByRole("button", { name: "Marcar principal" }).click()
    await application.page.getByRole("button", { name: "Finalizar sesión fotográfica" }).click()
    await expect(application.page.getByText("1 rostro detectado", { exact: true })).toBeVisible()
    await expect(application.page.getByText("Fondo: sin cambios", { exact: true })).toBeVisible()
    await expect(application.page.getByText("Piel: aplicado", { exact: true })).toBeVisible()
    await expect(application.page.getByText("Ojos: aplicado", { exact: true })).toBeVisible()
    await expect(application.page.getByText("Dientes: aplicado", { exact: true })).toBeVisible()
    await expect(application.page.getByText("Luz facial: aplicado", { exact: true })).toBeVisible()
    await expect(application.page.getByLabel("Suavizado de piel")).toHaveCount(0)
    await expect(application.page.getByText("Evento pulido automático · detección local sin identificación", { exact: true })).toBeVisible()
  } finally {
    await application.close()
  }
})
