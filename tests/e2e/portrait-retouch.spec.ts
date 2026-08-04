import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { expect, test } from "@playwright/test"
import sharp from "sharp"

import { PortraitRetoucher } from "../../src/server/portrait-retoucher.js"
import { TestApplication } from "./support/test-application.js"

const sampleRgb = async (image: Buffer, xRatio: number, yRatio: number): Promise<number[]> => {
  const { data, info } = await sharp(image).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  const x = Math.min(info.width - 1, Math.round(info.width * xRatio))
  const y = Math.min(info.height - 1, Math.round(info.height * yRatio))
  const offset = (y * info.width + x) * 3
  return [...data.subarray(offset, offset + 3)]
}

const colorDistance = (first: number[], second: number[]): number =>
  Math.sqrt(first.reduce((sum, channel, index) => sum + (channel - second[index]) ** 2, 0))

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

test("expone niveles conservadores y análisis facial en el flujo visible", async ({ browser }) => {
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
    await expect(application.page.getByText("Suave", { exact: true })).toBeVisible()
    const slider = application.page.getByLabel("Suavizado de piel")
    await slider.fill("0")
    await expect(application.page.getByText("Desactivado", { exact: true })).toBeVisible()
    await slider.fill("2")
    await expect(application.page.getByText("Medio", { exact: true })).toBeVisible()
    await expect(application.page.getByText("Detección local sin identificación", { exact: false })).toBeVisible()
  } finally {
    await application.close()
  }
})
