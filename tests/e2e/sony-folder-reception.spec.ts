import { copyFile, mkdtemp, rename, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { expect, test } from "@playwright/test"

import { prepareSimulatedPair } from "../../src/server/simulator.js"
import { TestApplication } from "./support/test-application.js"

test("incorpora la carpeta de Imaging Edge y conserva la importación manual si la carpeta se pierde", async ({ browser }) => {
  const application = await TestApplication.start(browser, "smartstudio-sony-folder-")
  const fixtureDirectory = await mkdtemp(path.join(tmpdir(), "smartstudio-sony-fixtures-"))
  const fallbackDirectory = await mkdtemp(path.join(tmpdir(), "smartstudio-sony-fallback-"))
  const sourceDirectory = await mkdtemp(path.join(tmpdir(), "smartstudio-imaging-edge-"))
  const disconnectedDirectory = `${sourceDirectory}-disconnected`

  try {
    await application.page.getByLabel("Nombre del evento").fill("Prueba Sony USB")
    await application.page.getByRole("button", { name: "Crear evento" }).click()
    await application.page.getByLabel("Carpeta de recepción Sony").fill(sourceDirectory)
    await application.page.getByRole("button", { name: "Conectar carpeta Sony" }).click()
    await expect(application.page.getByText("Carpeta de Imaging Edge disponible; conexión USB sin confirmar")).toBeVisible()

    await application.page.getByRole("button", { name: "Iniciar sesión fotográfica" }).click()
    await application.page.getByRole("button", { name: "Iniciar serie" }).click()
    const first = await prepareSimulatedPair({
      dataDirectory: fallbackDirectory,
      baseName: "DSC00001",
      capturedAt: new Date().toISOString(),
    })
    await copyFile(first.jpegPath, path.join(sourceDirectory, "DSC00001.JPG"))
    await expect(application.page.getByTestId("capture-DSC00001").getByText("RAW pendiente", { exact: false })).toBeVisible({ timeout: 8_000 })
    await expect(application.page.getByTestId("capture-DSC00001").getByText("Carpeta Sony/Imaging Edge", { exact: false })).toBeVisible()
    await copyFile(first.rawPath, path.join(sourceDirectory, "DSC00001.ARW"))
    await expect(application.page.getByTestId("capture-DSC00001").getByText("RAW + JPEG asociados", { exact: false })).toBeVisible({ timeout: 8_000 })

    await rename(sourceDirectory, disconnectedDirectory)
    await expect(application.page.getByText("Carpeta de recepción Sony no disponible")).toBeVisible({ timeout: 8_000 })
    await expect(application.page.getByRole("button", { name: "Importar carpeta" })).toBeVisible()

    const fallback = await prepareSimulatedPair({
      dataDirectory: fixtureDirectory,
      baseName: "DSC00002",
      capturedAt: new Date().toISOString(),
    })
    await application.page.getByLabel("Carpeta de respaldo").setInputFiles(path.dirname(fallback.jpegPath))
    await application.page.getByRole("button", { name: "Importar carpeta" }).click()
    await expect(application.page.getByTestId("capture-DSC00002").getByText("RAW + JPEG asociados", { exact: false })).toBeVisible()
    await expect(application.page.getByTestId("capture-DSC00002").getByText("Carpeta de respaldo", { exact: false })).toBeVisible()

    await application.reopen()
    await expect(application.page.getByText("Carpeta de recepción Sony no disponible")).toBeVisible()
    await expect(application.page.getByTestId("capture-DSC00001")).toBeVisible()
    await expect(application.page.getByTestId("capture-DSC00002")).toBeVisible()
  } finally {
    await application.close()
    await rm(fixtureDirectory, { recursive: true, force: true })
    await rm(fallbackDirectory, { recursive: true, force: true })
    await rm(sourceDirectory, { recursive: true, force: true })
    await rm(disconnectedDirectory, { recursive: true, force: true })
  }
})
