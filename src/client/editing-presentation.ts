import type { EditingJob } from "../shared/workflow.js"

export const editingStatusPresentation: Record<EditingJob["status"], { badge: string; history: string }> = {
  queued: { badge: "En cola", history: "Edición en cola" },
  processing: { badge: "Procesando", history: "Edición en proceso" },
  "awaiting-jpeg-authorization": { badge: "Requiere decisión JPEG", history: "Esperando decisión sobre JPEG" },
  "jpeg-rejected": { badge: "JPEG rechazado", history: "Procesamiento desde JPEG rechazado" },
  review: { badge: "Lista para revisar", history: "Edición lista para revisar" },
  approved: { badge: "Edición aprobada", history: "Edición aprobada" },
  failed: { badge: "Falló", history: "Edición fallida" },
  interrupted: { badge: "Interrumpido", history: "Edición interrumpida" },
  cancelled: { badge: "Cancelado", history: "Edición cancelada" },
}
