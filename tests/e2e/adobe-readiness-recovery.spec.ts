import { mkdir } from "node:fs/promises"
import path from "node:path"
import { expect, test } from "@playwright/test"
import sharp from "sharp"

import type { AdobeReadiness } from "../../src/shared/operations.js"
import type { EditingEngine } from "../../src/server/editing-engine.js"
import { TestApplication } from "./support/test-application.js"

const controlledAdobeEngine: EditingEngine = {
  id: "adobe",
  async render(_job, _capture, destination, _origin, lightweight) {
    await mkdir(path.dirname(destination), { recursive: true })
    await sharp({ create: { width: lightweight ? 640 : 1_280, height: lightweight ? 426 : 852, channels: 3, background: "#435b70" } })
      .jpeg({ quality: 90 })
      .toFile(destination)
    return {
      lensCorrectionApplied: true,
      portraitResult: { faces: 1, treated: 1, eyesEnhanced: true, teethWhitened: true, warnings: [], backdrop: "unchanged", backdropDiagnostics: null },
      processingRoute: "cpu",
      usedRawFallback: false,
    }
  },
}

const readiness = (ready: boolean): AdobeReadiness => ({
  status: ready ? "ready" : "unavailable",
  checkedAt: new Date().toISOString(),
  checks: [
    { id: "photoshop", label: "Photoshop estable", ready, detail: ready ? "controlado" : "No encontrado" },
    { id: "camera-raw", label: "Adobe Camera Raw", ready, detail: ready ? "controlado" : "No encontrado" },
    { id: "preset", label: "Preset seleccionado", ready, detail: ready ? "controlado" : "No configurado" },
    { id: "droplet", label: "Droplet de Photoshop", ready, detail: ready ? "controlado" : "No configurado" },
    { id: "action", label: "Action de Photoshop", ready, detail: ready ? "controlado" : "No configurado" },
    { id: "exchange", label: "Carpetas de intercambio", ready, detail: ready ? "controlado" : "Acceso denegado" },
    { id: "offline-resources", label: "Recursos para operar sin conexión", ready, detail: ready ? "controlado" : "No configurado" },
  ],
})

async function createPendingJob(application: TestApplication) {
  await application.page.getByLabel("Nombre del evento").fill("Recuperación Adobe")
  await application.page.getByRole("button", { name: "Crear evento" }).click()
  await expect(application.page.getByText("La ruta Adobe todavía no está preparada", { exact: true })).toBeVisible()
  await expect(application.page.getByText(/Carpetas de intercambio/)).toBeVisible()
  await application.page.getByRole("button", { name: "Iniciar sesión fotográfica" }).click()
  await application.page.getByRole("button", { name: "Iniciar serie" }).click()
  await application.page.getByRole("button", { name: "Simular captura RAW + JPEG" }).click()
  await expect(application.page.getByText("RAW + JPEG asociados", { exact: false })).toBeVisible()
  const capture = (await application.state()).events[0].sessions[0].series[0].captures[0]
  await application.page.getByRole("button", { name: "Cerrar serie" }).click()
  const captureCard = application.page.getByTestId(`capture-${capture.baseName}`)
  await captureCard.getByRole("button", { name: "Seleccionar", exact: true }).click()
  await captureCard.getByRole("button", { name: "Marcar principal" }).click()
  await application.page.getByRole("button", { name: "Finalizar sesión fotográfica" }).click()
  const jobCard = application.page.getByTestId(`editing-job-${capture.baseName}`)
  await expect(jobCard.getByText("Trabajo Adobe pendiente", { exact: true })).toBeVisible()
  return { capture, jobCard }
}

test("conserva el trabajo pendiente y lo recupera al corregir la preparación Adobe", async ({ browser }) => {
  let adobeReady = false
  const application = await TestApplication.start(browser, "smartstudio-adobe-recovery-", {
    testFeatures: true,
    editingEngine: controlledAdobeEngine,
    adobeReadinessProvider: async () => readiness(adobeReady),
  })
  try {
    const { capture, jobCard } = await createPendingJob(application)
    await jobCard.getByRole("button", { name: "Conservar pendiente" }).click()
    let state = await application.state()
    expect(state.editingJobs[0].engineFallbackDecision).toBe("rejected")
    expect(state.editingJobs[0].versions).toHaveLength(0)

    await application.reopen()
    const reopenedCard = application.page.getByTestId(`editing-job-${capture.baseName}`)
    await expect(reopenedCard.getByText("Trabajo Adobe pendiente", { exact: true })).toBeVisible()
    adobeReady = true
    await reopenedCard.getByRole("button", { name: "Comprobar Adobe otra vez" }).click()
    await expect(reopenedCard.getByText("Lista para revisar", { exact: true })).toBeVisible()
    state = await application.state()
    expect(state.editingJobs[0].engine).toBe("adobe")
    expect(state.editingJobs[0].versions[0].engine).toBe("adobe")
  } finally {
    await application.close()
  }
})

test("solo usa darktable tras autorización explícita e identifica la versión como local", async ({ browser }) => {
  const application = await TestApplication.start(browser, "smartstudio-adobe-local-fallback-", {
    testFeatures: true,
    editingEngine: controlledAdobeEngine,
    adobeReadinessProvider: async () => readiness(false),
  })
  try {
    const { jobCard } = await createPendingJob(application)
    await jobCard.getByRole("button", { name: "Usar motor local" }).click()
    await expect(jobCard.getByText("Lista para revisar", { exact: true })).toBeVisible()
    const state = await application.state()
    expect(state.editingJobs[0].engineFallbackDecision).toBe("authorized")
    expect(state.editingJobs[0].engine).toBe("local")
    expect(state.editingJobs[0].versions[0].engine).toBe("local")
    await expect(jobCard.getByText("Motor local", { exact: true })).toBeVisible()
  } finally {
    await application.close()
  }
})
