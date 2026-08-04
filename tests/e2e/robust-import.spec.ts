import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { expect, test } from "@playwright/test"
import sharp from "sharp"

import { activeSeries } from "../../src/shared/workflow.js"
import { TestApplication } from "./support/test-application.js"

test("asocia archivos concretos en cualquier orden y conserva originales", async ({ browser }) => {
  const application = await TestApplication.start(browser, "smartstudio-import-")
  const backupDirectory = await mkdtemp(path.join(tmpdir(), "smartstudio-backup-"))

  try {
    await application.page.getByLabel("Nombre del evento").fill("Importación robusta")
    await application.page.getByRole("button", { name: "Crear evento" }).click()
    await application.page.getByRole("button", { name: "Iniciar sesión fotográfica" }).click()
    await application.page.getByRole("button", { name: "Iniciar serie" }).click()

    await application.page.getByRole("button", { name: "Simular JPEG primero" }).click()
    let card = application.page.getByTestId("capture-SIM_S01_R01_001")
    await expect(card.getByText("RAW pendiente · JPEG disponible", { exact: false })).toBeVisible()
    await expect(card.getByAltText("Vista previa SIM_S01_R01_001")).toBeVisible()
    await application.reopen()
    card = application.page.getByTestId("capture-SIM_S01_R01_001")
    await card.getByRole("button", { name: "Completar componente pendiente" }).click()
    await expect(card.getByText("Completa", { exact: true })).toBeVisible()

    await application.page.getByRole("button", { name: "Simular RAW primero" }).click()
    card = application.page.getByTestId("capture-SIM_S01_R01_002")
    await expect(card.getByText("JPEG pendiente · RAW conservado", { exact: false })).toBeVisible()
    await expect(card.getByText("JPEG pendiente", { exact: true })).toBeVisible()
    await card.getByRole("button", { name: "Completar componente pendiente" }).click()
    await expect(card.getByAltText("Vista previa SIM_S01_R01_002")).toBeVisible()

    await sharp({
      create: { width: 120, height: 80, channels: 3, background: "#43624f" },
    }).jpeg().toFile(path.join(backupDirectory, "BACKUP_001.JPG"))
    await sharp({
      create: { width: 120, height: 80, channels: 3, background: "#705341" },
    }).jpeg().toFile(path.join(backupDirectory, "BACKUP_002.JPG"))
    await writeFile(path.join(backupDirectory, "BACKUP_001.ARW"), Buffer.from("RAW_BACKUP_001"))
    await writeFile(path.join(backupDirectory, "LEEME.txt"), "archivo ajeno", "utf8")
    const filesInput = application.page.getByLabel("Archivos RAW y JPEG")
    await expect(filesInput).toHaveAttribute("accept", ".arw,.jpg,.jpeg,image/jpeg")
    await expect(filesInput).not.toHaveAttribute("webkitdirectory", "")
    await filesInput.setInputFiles([
      path.join(backupDirectory, "BACKUP_001.ARW"),
      path.join(backupDirectory, "BACKUP_001.JPG"),
      path.join(backupDirectory, "BACKUP_002.JPG"),
      path.join(backupDirectory, "LEEME.txt"),
    ])
    await expect(application.page.getByText("Seleccionados: BACKUP_001.ARW · BACKUP_001.JPG · BACKUP_002.JPG · LEEME.txt")).toBeVisible()
    await application.page.getByRole("button", { name: "Importar archivos" }).click()

    const completeManual = application.page.getByTestId("capture-BACKUP_001")
    const incompleteManual = application.page.getByTestId("capture-BACKUP_002")
    await expect(completeManual.getByText("Completa", { exact: true })).toBeVisible()
    await expect(incompleteManual.getByText("RAW pendiente", { exact: false })).toBeVisible()
    await expect(completeManual.getByText("Archivos seleccionados", { exact: false })).toBeVisible()
    await expect(application.page.getByText("Archivo no reconocido: LEEME.txt")).toBeVisible()

    await incompleteManual.getByRole("button", { name: "Autorizar JPEG de emergencia" }).click()
    await completeManual.getByRole("button", { name: "Excluir de revisión" }).click()
    await expect(completeManual.getByText("Excluida")).toBeVisible()

    const stateBeforeRestart = await application.state()
    const importedCapture = activeSeries(stateBeforeRestart)!.captures.find((capture) => capture.baseName === "BACKUP_001")!
    const rawBefore = await application.readDataFile(importedCapture.rawRelativePath!)
    const jpegBefore = await application.readDataFile(importedCapture.jpegRelativePath!)

    await application.reopen()
    await expect(application.page.getByText("JPEG de emergencia autorizado")).toBeVisible()
    await expect(application.page.getByText("Excluida")).toBeVisible()
    expect(await application.readDataFile(importedCapture.rawRelativePath!)).toEqual(rawBefore)
    expect(await application.readDataFile(importedCapture.jpegRelativePath!)).toEqual(jpegBefore)
  } finally {
    await application.close()
    await rm(backupDirectory, { recursive: true, force: true })
  }
})
