import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { expect, test } from "@playwright/test"
import sharp from "sharp"

import { PortraitRetoucher } from "../../src/server/portrait-retoucher.js"
import { TestApplication } from "./support/test-application.js"

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
    const before = await sharp(source).raw().toBuffer({ resolveWithObject: true })
    const result = await new PortraitRetoucher().apply(source, destination, 1, { kind: "group", faceCount: 3 })
    const after = await sharp(destination).raw().toBuffer({ resolveWithObject: true })
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
    expect(result.warnings[0]).toContain("No se detectaron rostros")
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
