import type { EditingAdjustments, EditingJob, EditingProfile } from "../shared/workflow.js"

export const historicalAdjustmentPresentation = (profile: EditingProfile, adjustments: EditingAdjustments): string | null => {
  if (profile.id !== "natural-event") return null
  return `Parámetros históricos: exposición ${adjustments.exposure} · temperatura ${adjustments.temperature} · color ${adjustments.colorIntensity} · piel ${adjustments.skinSmoothing}`
}

export const editingStatusPresentation: Record<EditingJob["status"], { badge: string; history: string }> = {
  queued: { badge: "En cola", history: "Edición en cola" },
  processing: { badge: "Procesando", history: "Edición en proceso" },
  "awaiting-jpeg-authorization": { badge: "Requiere decisión JPEG", history: "Esperando decisión sobre JPEG" },
  "jpeg-rejected": { badge: "JPEG rechazado", history: "Procesamiento desde JPEG rechazado" },
  review: { badge: "Lista para revisar", history: "Edición lista para revisar" },
  approved: { badge: "Edición aprobada", history: "Edición aprobada" },
  rejected: { badge: "Edición rechazada", history: "Edición rechazada; se conserva el original" },
  failed: { badge: "Falló", history: "Edición fallida" },
  interrupted: { badge: "Interrumpido", history: "Edición interrumpida" },
  cancelled: { badge: "Cancelado", history: "Edición cancelada" },
}
