import { createHash } from "node:crypto"
import { expect, test } from "@playwright/test"
import sharp from "sharp"

import { AdobeEditingEngine } from "../../src/server/adobe-editing-engine.js"
import type { AdobeReadiness } from "../../src/shared/operations.js"
import { TestApplication } from "./support/test-application.js"

const readyAdobe = async (): Promise<AdobeReadiness> => ({
  status: "ready",
  checkedAt: new Date().toISOString(),
  checks: [
    { id: "photoshop", label: "Photoshop estable", ready: true, detail: "controlado" },
    { id: "camera-raw", label: "Adobe Camera Raw", ready: true, detail: "controlado" },
    { id: "preset", label: "Preset seleccionado", ready: true, detail: "SmartStudio Natural Adobe" },
    { id: "droplet", label: "Droplet de Photoshop", ready: true, detail: "controlado" },
    { id: "action", label: "Action de Photoshop", ready: true, detail: "SmartStudio-Natural" },
    { id: "exchange", label: "Carpetas de intercambio", ready: true, detail: "temporal" },
    { id: "offline-resources", label: "Recursos para operar sin conexión", ready: true, detail: "controlado" },
  ],
})

const digest = (value: Buffer): string => createHash("sha256").update(value).digest("hex")

test("recorre SmartStudio-Natural mediante el contrato de proceso y reutiliza la salida completa al aprobar", async ({ browser }) => {
  const application = await TestApplication.start(browser, "smartstudio-adobe-natural-", {
    testFeatures: true,
    editingEngineFactory: (dataDirectory) => new AdobeEditingEngine(dataDirectory),
    adobeReadinessProvider: readyAdobe,
  })
  try {
    await application.page.getByLabel("Nombre del evento").fill("Natural Adobe")
    await application.page.getByRole("button", { name: "Crear evento" }).click()
    await application.page.getByRole("button", { name: "Iniciar sesión fotográfica" }).click()
    await application.page.getByRole("button", { name: "Iniciar serie" }).click()
    await application.page.getByRole("button", { name: "Simular captura RAW + JPEG" }).click()
    await application.page.getByRole("button", { name: "Simular captura RAW + JPEG" }).click()
    await expect(application.page.getByText("RAW + JPEG asociados", { exact: false })).toHaveCount(2)
    let state = await application.state()
    const captures = state.events[0].sessions[0].series[0].captures
    const originalRaw = digest(await application.readDataFile(captures[0].rawRelativePath!))
    const originalJpeg = digest(await application.readDataFile(captures[0].jpegRelativePath!))
    await application.page.getByRole("button", { name: "Cerrar serie" }).click()
    for (const capture of captures) {
      await application.page.getByTestId(`capture-${capture.baseName}`).getByRole("button", { name: "Seleccionar", exact: true }).click()
    }
    await application.page.getByTestId(`capture-${captures[0].baseName}`).getByRole("button", { name: "Marcar principal" }).click()
    await application.page.getByRole("button", { name: "Finalizar sesión fotográfica" }).click()
    const card = application.page.getByTestId(`editing-job-${captures[0].baseName}`)
    await expect(card.getByText("Lista para revisar", { exact: true })).toBeVisible()
    await expect(card.getByLabel("Comparación antes y después")).toBeVisible()
    await expect(card.getByLabel("Ampliación")).toBeVisible()
    await expect(card.getByLabel("Desplazamiento horizontal")).toBeVisible()
    state = await application.state()
    expect(state.editingJobs).toHaveLength(1)
    const version = state.editingJobs[0].versions[0]
    expect(version.engine).toBe("adobe")
    expect(version.origin).toBe("raw")
    expect(version.profile.name).toBe("Natural de evento")
    expect(version.fullRelativePath).not.toBeNull()
    expect(version.deliveryStatus).toBe("not-requested")
    const fullBeforeApproval = await application.readDataFile(version.fullRelativePath!)
    const metadata = await sharp(fullBeforeApproval).metadata()
    expect(metadata.format).toBe("jpeg")
    expect(metadata.space).toBe("srgb")
    expect(metadata.exif).toBeUndefined()
    expect(digest(await application.readDataFile(captures[0].rawRelativePath!))).toBe(originalRaw)
    expect(digest(await application.readDataFile(captures[0].jpegRelativePath!))).toBe(originalJpeg)
    const contractFilesBeforeApproval = await application.listDataFiles("adobe-exchange/incoming")
    expect(contractFilesBeforeApproval.some((file) => file.endsWith("request.json"))).toBe(true)
    expect(contractFilesBeforeApproval.some((file) => file.endsWith("result.json"))).toBe(true)

    await card.getByRole("button", { name: "Aprobar edición" }).click()
    await expect(card.getByText("Edición aprobada y lista para entrega", { exact: true })).toBeVisible()
    state = await application.state()
    expect(state.editingJobs[0].versions[0].deliveryStatus).toBe("ready")
    expect(digest(await application.readDataFile(version.fullRelativePath!))).toBe(digest(fullBeforeApproval))
    expect(await application.listDataFiles("adobe-exchange/incoming")).toHaveLength(contractFilesBeforeApproval.length)

    await card.getByRole("button", { name: "Procesar alternativa" }).click()
    await expect.poll(async () => (await application.state()).editingJobs.length).toBe(2)
    await application.reopen()
    state = await application.state()
    expect(state.editingJobs[0].versions[0].engine).toBe("adobe")
    expect(state.editingJobs[0].approvedVersionId).toBe(state.editingJobs[0].versions[0].id)
  } finally {
    await application.close()
  }
})
