import { type FormEvent, useMemo, useRef, useState } from "react"
import { CircleAlert, FolderInput, Upload } from "lucide-react"

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

const INCOMPLETE_QUALITY_PENALTY = 40
const EXCLUDED_QUALITY_PENALTY = 100

export function CaptureWorkspace({ series, session, busy, transition, execute, reportError }: Props) {
  const [importFiles, setImportFiles] = useState<FileList | null>(null)
  const [qualityOrder, setQualityOrder] = useState(false)
  const importInputRef = useRef<HTMLInputElement>(null)
  const selectedCaptures = sessionCaptures(session).filter((capture) => capture.selected)
  const selectionReady = sessionIsReadyForEditing(session)
  const searchParameters = new URLSearchParams(window.location.search)
  const showSimulatedControls = searchParameters.has("simulated-controls")
  const showQualityFixtures = searchParameters.has("quality-fixtures")
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

  const importSelectedFiles = (event: FormEvent) => {
    event.preventDefault()
    if (!importFiles || importFiles.length === 0) {
      reportError("Selecciona el archivo RAW, el JPEG o ambos.")
      return
    }
    const body = new FormData()
    for (const file of importFiles) body.append("files", file, file.name)
    execute(async () => {
      const response = await fetch("/api/imports", { method: "POST", body })
      const result = (await response.json()) as WorkflowState | { error: string }
      if (!response.ok) throw new Error("error" in result ? result.error : "No se pudieron importar los archivos.")
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
          {showSimulatedControls && (
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
          )}
          <form onSubmit={importSelectedFiles} className="grid gap-3 rounded-lg border border-border bg-background/35 p-3">
            <Input
              type="text"
              readOnly
              aria-label="Archivos seleccionados"
              value={importFiles?.length ? Array.from(importFiles).map((file) => file.name).join(" · ") : ""}
              placeholder="Ningún archivo seleccionado"
              className="bg-background"
            />
            <input
              ref={importInputRef}
              id={`capture-files-${series.id}`}
              type="file"
              multiple
              accept=".arw,.cr2,.jpg,.jpeg,image/jpeg"
              aria-label="Archivos RAW y JPEG"
              onChange={(event) => setImportFiles(event.target.files)}
              className="sr-only"
            />
            <div className="flex items-center justify-between gap-3">
              <Button type="button" size="sm" variant="outline" className="border-sky-500/60 bg-sky-500/10 text-sky-300 hover:bg-sky-500/20 hover:text-sky-200" onClick={() => importInputRef.current?.click()}>
                <Upload data-icon="inline-start" />
                Subir archivo
              </Button>
              <Button type="submit" size="sm" disabled={busy}>Importar archivos</Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Elige directamente el ARW o CR2 y su JPG/JPEG. Puedes seleccionar ambos a la vez.
            </p>
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
