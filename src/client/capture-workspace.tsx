import { type FormEvent, type InputHTMLAttributes, useMemo, useState } from "react"
import { CircleAlert, FolderInput } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import {
  sessionCaptures,
  sessionIsReadyForEditing,
  type PhotoSession,
  type Series,
  type WorkflowState,
} from "../shared/workflow.js"
import { PreviousSeries } from "./workflow-panels.js"
import { CaptureCard } from "./capture-card.js"

type Props = {
  series: Series
  session: PhotoSession
  busy: boolean
  transition: (path: string, body?: unknown) => void
  execute: (action: () => Promise<WorkflowState>) => void
  reportError: (message: string) => void
}

const directoryInputProps = {
  webkitdirectory: "",
} as InputHTMLAttributes<HTMLInputElement>

const INCOMPLETE_QUALITY_PENALTY = 40
const EXCLUDED_QUALITY_PENALTY = 100

export function CaptureWorkspace({ series, session, busy, transition, execute, reportError }: Props) {
  const [importFiles, setImportFiles] = useState<FileList | null>(null)
  const [qualityOrder, setQualityOrder] = useState(false)
  const selectedCaptures = sessionCaptures(session).filter((capture) => capture.selected)
  const selectionReady = sessionIsReadyForEditing(session)
  const showQualityFixtures = new URLSearchParams(window.location.search).has("quality-fixtures")
  const visibleCaptures = useMemo(
    () => qualityOrder
      ? series.captures.toSorted((left, right) => {
          const score = (capture: Series["captures"][number]) =>
            (capture.quality?.score ?? 0) -
            (capture.status === "complete" ? 0 : INCOMPLETE_QUALITY_PENALTY) -
            (capture.excluded ? EXCLUDED_QUALITY_PENALTY : 0)
          return score(right) - score(left)
        })
      : series.captures,
    [qualityOrder, series.captures],
  )

  const importFromFolder = (event: FormEvent) => {
    event.preventDefault()
    if (!importFiles || importFiles.length === 0) {
      reportError("Selecciona una carpeta de respaldo.")
      return
    }
    const body = new FormData()
    for (const file of importFiles) body.append("files", file, file.name)
    execute(async () => {
      const response = await fetch("/api/imports", { method: "POST", body })
      const result = (await response.json()) as WorkflowState | { error: string }
      if (!response.ok) throw new Error("error" in result ? result.error : "No se pudo importar la carpeta.")
      return result as WorkflowState
    })
  }

  return (
    <section>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-[0.18em] text-primary">SERIE {series.number}</p>
          <h3 className="mt-1 text-xl font-semibold">
            {series.status === "capturing" ? "Capturando" : series.status === "selected" ? "Selección lista" : "Revisión"}
          </h3>
        </div>
        <Badge variant="outline">{series.captures.length} captura{series.captures.length === 1 ? "" : "s"}</Badge>
      </div>

      {series.status === "capturing" && (
        <div className="my-6 grid gap-3">
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" disabled={busy} onClick={() => transition("/api/simulated-captures")}>
              <FolderInput data-icon="inline-start" />
              Simular captura RAW + JPEG
            </Button>
            <Button variant="outline" disabled={busy} onClick={() => transition("/api/simulated-captures/jpeg-first")}>
              Simular JPEG primero
            </Button>
            <Button variant="outline" disabled={busy} onClick={() => transition("/api/simulated-captures/raw-first")}>
              Simular RAW primero
            </Button>
            {showQualityFixtures && (
              <Button variant="outline" disabled={busy} onClick={() => transition("/api/simulated-captures/quality-fixtures")}>
                Cargar fotografías controladas
              </Button>
            )}
          </div>
          <form onSubmit={importFromFolder} className="grid gap-2 rounded-lg border border-border bg-background/35 p-3 sm:grid-cols-[1fr_auto]">
            <Input
              {...directoryInputProps}
              type="file"
              multiple
              aria-label="Carpeta de respaldo"
              onChange={(event) => setImportFiles(event.target.files)}
              className="h-8 bg-background file:text-foreground"
            />
            <Button type="submit" size="sm" variant="secondary" disabled={busy}>Importar carpeta</Button>
            <p className="text-xs text-muted-foreground sm:col-span-2">Selecciona la carpeta completa. Si el navegador no lo permite, puedes seleccionar varios archivos como alternativa.</p>
          </form>
          <div className="flex gap-2">
            <Button disabled={busy || series.captures.length === 0} onClick={() => transition("/api/series/close")}>Cerrar serie</Button>
            <Button variant="outline" disabled={busy} onClick={() => transition("/api/sessions/cancel")}>Cancelar sesión fotográfica</Button>
          </div>
        </div>
      )}

      {series.warnings.length > 0 && (
        <Alert className="my-4 border-amber-500/30 bg-amber-500/10 text-amber-100">
          <CircleAlert />
          <AlertTitle>Advertencias de importación</AlertTitle>
          <AlertDescription>{series.warnings.at(-1)}</AlertDescription>
        </Alert>
      )}

      {series.status !== "capturing" && (
        <div className="my-6 flex flex-wrap gap-2">
          <Button variant="secondary" disabled={busy} onClick={() => transition("/api/series")}>Iniciar otra serie</Button>
          <Button variant="outline" disabled={busy} onClick={() => transition("/api/sessions/cancel")}>Cancelar sesión fotográfica</Button>
          <Button variant="outline" onClick={() => setQualityOrder((current) => !current)}>
            {qualityOrder ? "Orden original" : "Ordenar por calidad"}
          </Button>
          <Button disabled={busy || !selectionReady} onClick={() => transition("/api/sessions/complete")}>Finalizar sesión fotográfica</Button>
        </div>
      )}

      {series.status !== "capturing" && (
        <Card size="sm" className={cn("mb-5", selectionReady ? "border-primary/50 bg-primary/5" : "bg-muted/20")}>
          <CardHeader>
            <CardTitle>{selectionReady ? "Sesión fotográfica lista para edición" : "Selección en curso"}</CardTitle>
            <CardDescription>{selectedCaptures.length} de 3 seleccionadas · {selectedCaptures.some((capture) => capture.principal) ? "Principal definida" : "Falta definir la principal"}</CardDescription>
          </CardHeader>
          {selectedCaptures.length > 0 && (
            <CardContent className="flex flex-wrap gap-2">
              {selectedCaptures.map((capture) => (
                <div data-testid={`selection-${capture.baseName}`} key={capture.id} className="flex items-center gap-1 rounded-lg border border-border bg-background p-1 pl-2 text-xs">
                  <span>{capture.baseName}{capture.principal ? " · Principal" : " · Alternativa"}</span>
                  {!capture.principal && <Button size="xs" variant="ghost" onClick={() => transition(`/api/captures/${capture.id}/principal`)}>Hacer principal</Button>}
                  <Button size="xs" variant="ghost" onClick={() => transition(`/api/captures/${capture.id}/deselect`)}>Quitar</Button>
                </div>
              ))}
            </CardContent>
          )}
        </Card>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {visibleCaptures.map((capture) => (
          <CaptureCard
            key={capture.id}
            capture={capture}
            seriesStatus={series.status}
            selectedCount={selectedCaptures.length}
            busy={busy}
            transition={transition}
          />
        ))}
      </div>
      {session.series.length > 1 && (
        <PreviousSeries
          series={session.series.slice(0, -1)}
          busy={busy}
          selectedCount={selectedCaptures.length}
          reviewEnabled={series.status !== "capturing"}
          transition={transition}
        />
      )}
    </section>
  )
}
