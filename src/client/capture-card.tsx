import { Check, ImageIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import type { Capture, QualityWarning, Series } from "../shared/workflow.js"

const qualityLabels: Record<QualityWarning, string> = {
  blur: "Posible desenfoque",
  motion: "Posible movimiento",
  "eyes-closed": "Posibles ojos cerrados",
  "poor-framing": "Revisar encuadre",
  exposure: "Exposición incorrecta",
  "incomplete-file": "Archivo incompleto",
}

type Props = {
  capture: Capture
  seriesStatus: Series["status"]
  selectedCount: number
  busy: boolean
  transition: (path: string, body?: unknown) => void
}

export function CaptureCard({ capture, seriesStatus, selectedCount, busy, transition }: Props) {
  const warnings: QualityWarning[] = [
    ...(capture.quality?.warnings ?? []),
    ...(capture.status === "complete" ? [] : ["incomplete-file" as const]),
  ]

  return (
    <Card data-testid={`capture-${capture.baseName}`} size="sm" className={cn("border-border bg-background/45", capture.principal && "ring-2 ring-primary/60", capture.excluded && "opacity-55")}>
      <div className="relative -mt-3 aspect-3/2 overflow-hidden bg-muted">
        {capture.jpegRelativePath ? (
          <Dialog>
            <DialogTrigger asChild>
              <button className="size-full p-0" aria-label={`Ampliar ${capture.baseName}`}>
                <img className="size-full object-cover" src={`/captures/${capture.id}/preview`} alt={`Vista previa ${capture.baseName}`} />
              </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-4xl">
              <DialogHeader>
                <DialogTitle>{capture.baseName}</DialogTitle>
                <DialogDescription>Vista ampliada para revisar expresión, enfoque y encuadre.</DialogDescription>
              </DialogHeader>
              <img className="max-h-[75vh] w-full rounded-lg object-contain" src={`/captures/${capture.id}/preview`} alt={`Vista ampliada ${capture.baseName}`} />
            </DialogContent>
          </Dialog>
        ) : (
          <div className="grid size-full place-items-center text-center text-sm text-muted-foreground">
            <span><ImageIcon className="mx-auto mb-2 size-7" />JPEG pendiente</span>
          </div>
        )}
        {capture.principal && <Badge className="absolute right-3 top-3"><Check data-icon="inline-start" />Principal</Badge>}
        {capture.excluded && <Badge variant="secondary" className="absolute left-3 top-3">Excluida</Badge>}
      </div>
      <CardHeader>
        <CardTitle>{capture.baseName}</CardTitle>
        <CardDescription>
          {capture.status === "complete" ? "RAW + JPEG asociados" : capture.status === "raw-pending" ? "RAW pendiente · JPEG disponible" : "JPEG pendiente · RAW conservado"}
          {` · ${capture.source === "manual-folder" ? "Archivos seleccionados" : capture.source === "sony-usb-folder" ? "Carpeta Sony/Imaging Edge" : "Carpeta simulada"}`}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {capture.quality && <Badge variant="secondary">Calidad {capture.quality.score}/100</Badge>}
        {warnings.map((warning) => <Badge key={warning} variant="outline">{qualityLabels[warning]}</Badge>)}
        <Badge variant={capture.status === "complete" ? "default" : "outline"}>{capture.status === "complete" ? "Completa" : "Incompleta"}</Badge>
        {capture.emergencyJpegAuthorized && <Badge variant="outline">JPEG de emergencia autorizado</Badge>}
        {capture.status !== "complete" && capture.source === "simulated-folder" && (
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => transition(`/api/captures/${capture.id}/simulate-missing`)}>Completar componente pendiente</Button>
        )}
        {capture.status === "raw-pending" && !capture.emergencyJpegAuthorized && (
          <Button size="sm" variant="outline" disabled={busy} onClick={() => transition(`/api/captures/${capture.id}/authorize-jpeg`)}>Autorizar JPEG de emergencia</Button>
        )}
        {capture.excluded ? (
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => transition(`/api/captures/${capture.id}/restore`)}>Restaurar en revisión</Button>
        ) : (
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => transition(`/api/captures/${capture.id}/exclude`)}>Excluir de revisión</Button>
        )}
      </CardContent>
      {seriesStatus !== "capturing" && (
        <CardContent className="grid grid-cols-2 gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={busy || capture.selected || selectedCount >= 3 || capture.excluded || (capture.status !== "complete" && !capture.emergencyJpegAuthorized)}
            onClick={() => transition(`/api/captures/${capture.id}/select`)}
          >
            {capture.selected ? "Seleccionada" : "Seleccionar"}
          </Button>
          <Button size="sm" disabled={busy || !capture.selected || capture.principal} onClick={() => transition(`/api/captures/${capture.id}/principal`)}>
            {capture.principal ? "Es principal" : "Marcar principal"}
          </Button>
        </CardContent>
      )}
    </Card>
  )
}
