import { useEffect, useState } from "react"
import { Check, CircleAlert, LoaderCircle, WandSparkles } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import type { EditingJob, Event } from "../shared/workflow.js"
import { editingStatusPresentation } from "./editing-presentation.js"

const elapsedLabel = (job: EditingJob): string => {
  const start = new Date(job.startedAt ?? job.createdAt).getTime()
  const end = job.finishedAt ? new Date(job.finishedAt).getTime() : Date.now()
  const seconds = Math.max(0, Math.floor((end - start) / 1_000))
  if (seconds < 60) return `${seconds} s`
  return `${Math.floor(seconds / 60)} min ${seconds % 60} s`
}

function ComparisonViewer({ captureId, baseName, job }: { captureId: string; baseName: string; job: EditingJob }) {
  const [mode, setMode] = useState<"split" | "original" | "edited">("split")
  const [zoom, setZoom] = useState(1)
  const [panX, setPanX] = useState(0)
  const [panY, setPanY] = useState(0)
  const originalSource = `/captures/${captureId}/preview`
  const editedSource = `/editing/${job.id}/preview?ready=${encodeURIComponent(job.previewReadyAt ?? "")}`
  const imageStyle = { transform: `scale(${zoom}) translate(${panX / zoom}%, ${panY / zoom}%)` }
  const figure = (source: string, label: string, accent = false) => (
    <figure className={`overflow-hidden rounded-lg border ${accent ? "border-primary/35" : "border-border"} bg-background/45`}>
      <div className="overflow-hidden bg-black/20">
        <img src={source} alt={`${accent ? "Edición" : "Original"} ${baseName}`} className="max-h-[32rem] w-full object-contain transition-transform duration-150" style={imageStyle} />
      </div>
      <figcaption className={`px-3 py-2 text-xs font-medium ${accent ? "text-primary" : "text-muted-foreground"}`}>{label}</figcaption>
    </figure>
  )

  return (
    <div className="grid gap-3" aria-label="Comparación antes y después">
      <div className="flex flex-wrap gap-2">
        <Button size="xs" variant={mode === "split" ? "default" : "outline"} onClick={() => setMode("split")}>Vista dividida</Button>
        <Button size="xs" variant={mode === "original" ? "default" : "outline"} onClick={() => setMode("original")}>Ver original</Button>
        <Button size="xs" variant={mode === "edited" ? "default" : "outline"} onClick={() => setMode("edited")}>Ver edición</Button>
      </div>
      <div className={mode === "split" ? "grid gap-3 sm:grid-cols-2" : "grid gap-3"}>
        {(mode === "split" || mode === "original") && figure(originalSource, "Original")}
        {(mode === "split" || mode === "edited") && figure(editedSource, job.origin === "jpeg" ? "Procesada desde JPEG" : "Procesada desde RAW", true)}
      </div>
      <div className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-3">
        <label className="grid gap-1 text-xs"><span>Ampliación · {zoom.toFixed(1)}×</span><Input aria-label="Ampliación" type="range" min="1" max="3" step="0.1" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} /></label>
        <label className="grid gap-1 text-xs"><span>Desplazamiento horizontal</span><Input aria-label="Desplazamiento horizontal" type="range" min="-35" max="35" value={panX} onChange={(event) => setPanX(Number(event.target.value))} /></label>
        <label className="grid gap-1 text-xs"><span>Desplazamiento vertical</span><Input aria-label="Desplazamiento vertical" type="range" min="-35" max="35" value={panY} onChange={(event) => setPanY(Number(event.target.value))} /></label>
      </div>
    </div>
  )
}

function AdjustmentControls({ job, busy, transition }: {
  job: EditingJob
  busy: boolean
  transition: (path: string, body?: unknown) => void
}) {
  const [values, setValues] = useState(job.adjustments)
  useEffect(() => setValues(job.adjustments), [job.adjustments])
  const controls = [
    ["exposure", "Exposición", -1, 1, 0.1],
    ["temperature", "Temperatura", -1, 1, 0.1],
    ["colorIntensity", "Intensidad de color", -1, 1, 0.1],
    ["skinSmoothing", "Suavizado de piel", 0, 2, 1],
  ] as const
  return (
    <div className="grid gap-3 rounded-lg border border-border bg-background/35 p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        {controls.map(([key, label, min, max, step]) => (
          <label key={key} className="grid gap-1 text-xs font-medium">
            <span className="flex justify-between"><span>{label}</span><span>{key === "skinSmoothing" ? ["Desactivado", "Suave", "Medio"][values[key]] : values[key]}</span></span>
            <Input
              aria-label={label}
              type="range"
              min={min}
              max={max}
              step={step}
              value={values[key]}
              onChange={(event) => setValues({ ...values, [key]: Number(event.target.value) })}
            />
          </label>
        ))}
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" disabled={busy} onClick={() => transition(`/api/editing/${job.id}/reset`)}>
          Restablecer edición automática
        </Button>
        <Button disabled={busy} onClick={() => transition(`/api/editing/${job.id}/adjustments`, values)}>
          Aplicar ajustes
        </Button>
      </div>
    </div>
  )
}

export function EditingPanel({
  event,
  jobs,
  busy,
  transition,
}: {
  event: Event
  jobs: EditingJob[]
  busy: boolean
  transition: (path: string, body?: unknown) => void
}) {
  if (jobs.length === 0) return null

  return (
    <section className="mb-7" aria-labelledby="editing-heading">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-[0.18em] text-primary">EDICIÓN LOCAL</p>
          <h3 id="editing-heading" className="mt-1 text-lg font-semibold">Edición automática</h3>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{event.editingProfile.name} · v{event.editingProfile.version}</Badge>
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => transition("/api/events/profile/advance")}>Nueva versión del perfil</Button>
        </div>
      </div>

      <div className="grid gap-4">
        {jobs.toReversed().map((job) => {
          const session = event.sessions.find((item) => item.id === job.sessionId)
          const capture = session?.series.flatMap((series) => series.captures).find((item) => item.id === job.captureId)
          if (!session || !capture) return null
          const previewAvailable = Boolean(job.previewRelativePath)
          const currentVersion = job.versions.find((version) => version.id === job.currentVersionId)
          const approvedVersion = job.versions.find((version) => version.id === job.approvedVersionId)
          const alternatives = session.series.flatMap((series) => series.captures).filter((item) => item.id !== capture.id && item.selected)
          const previewDelayed = job.status === "processing" && Boolean(job.startedAt) && Date.now() - new Date(job.startedAt!).getTime() > 30_000

          return (
            <Card key={job.id} data-testid={`editing-job-${capture.baseName}`} size="sm" className="border-primary/25 bg-primary/5">
              <CardHeader>
                <div className="mb-2 grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
                  {job.status === "approved" ? <Check className="size-4" /> : job.status === "failed" ? <CircleAlert className="size-4" /> : job.status === "processing" ? <LoaderCircle className="size-4 animate-spin" /> : <WandSparkles className="size-4" />}
                </div>
                <CardTitle>Edición {session.number} · {capture.baseName}</CardTitle>
                <CardDescription>{event.name} · Procesamiento local sin modificar el RAW ni el JPEG originales.</CardDescription>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={job.status === "failed" || job.status === "interrupted" ? "destructive" : job.status === "approved" ? "default" : "secondary"}>
                  {editingStatusPresentation[job.status].badge}
                  </Badge>
                  <span className="text-xs text-muted-foreground">Tiempo: {elapsedLabel(job)} · Intentos: {job.attempts}</span>
                  <span className="text-xs text-muted-foreground">Perfil: {job.profile.name} v{job.profile.version}</span>
                </div>
              </CardHeader>

              {(job.status === "failed" || job.status === "interrupted") && (
                <CardContent>
                  <Alert variant="destructive" className="bg-destructive/10">
                    <CircleAlert />
                    <AlertTitle>No se pudo editar la fotografía</AlertTitle>
                    <AlertDescription>{job.error}</AlertDescription>
                  </Alert>
                </CardContent>
              )}
              {previewDelayed && (
                <CardContent><Alert className="border-amber-500/35 bg-amber-500/10"><CircleAlert /><AlertTitle>La vista previa tarda más de 30 segundos</AlertTitle><AlertDescription>Puedes continuar con nuevas sesiones mientras la edición sigue en la cola.</AlertDescription></Alert></CardContent>
              )}

              {(job.status === "awaiting-jpeg-authorization" || job.status === "jpeg-rejected") && (
                <CardContent className="grid gap-3">
                  <Alert variant={job.status === "awaiting-jpeg-authorization" ? "default" : "destructive"}>
                    <CircleAlert />
                    <AlertTitle>{job.status === "awaiting-jpeg-authorization" ? "El RAW no pudo revelarse" : "Procesamiento desde JPEG rechazado"}</AlertTitle>
                    <AlertDescription>{job.error}</AlertDescription>
                  </Alert>
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button variant="outline" disabled={busy} onClick={() => transition(`/api/editing/${job.id}/retry-raw`)}>
                      Reintentar RAW corregido
                    </Button>
                    {job.status === "awaiting-jpeg-authorization" && (
                      <Button variant="outline" disabled={busy} onClick={() => transition(`/api/editing/${job.id}/reject-jpeg`)}>
                        No procesar desde JPEG
                      </Button>
                    )}
                    <Button disabled={busy} onClick={() => transition(`/api/editing/${job.id}/authorize-jpeg`)}>
                      Autorizar procesar desde JPEG
                    </Button>
                  </div>
                </CardContent>
              )}

              {previewAvailable && (
                <CardContent className="grid gap-4">
                  {job.uncontrolledConditionsWarning && (
                    <Alert className="border-amber-500/35 bg-amber-500/10">
                      <CircleAlert />
                      <AlertTitle>Condiciones fuera del miniestudio controlado</AlertTitle>
                      <AlertDescription>{job.uncontrolledConditionsWarning}</AlertDescription>
                    </Alert>
                  )}
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline">{job.faceCount} rostro{job.faceCount === 1 ? "" : "s"} detectado{job.faceCount === 1 ? "" : "s"}</Badge>
                    <span>Detección local sin identificación · ojos y dientes: mejora suave</span>
                    <span>Ruta {job.metrics.processingRoute.toUpperCase()} · vista previa {job.metrics.previewMilliseconds ?? "—"} ms · JPEG completo {job.metrics.deliveryMilliseconds ?? "—"} ms · fallos {job.metrics.failures} · reintentos {job.metrics.retries}</span>
                  </div>
                  {job.accelerationWarning && <p className="text-xs text-amber-300">{job.accelerationWarning}</p>}
                  {job.portraitWarnings.map((warning) => (
                    <Alert key={warning} className="border-amber-500/35 bg-amber-500/10"><CircleAlert /><AlertTitle>Retoque facial omitido parcialmente</AlertTitle><AlertDescription>{warning}</AlertDescription></Alert>
                  ))}
                  <ComparisonViewer captureId={capture.id} baseName={capture.baseName} job={job} />
                  <AdjustmentControls job={job} busy={busy} transition={transition} />
                  <div className="grid gap-2 rounded-lg border border-border p-3">
                    <p className="text-xs font-semibold">Versiones conservadas</p>
                    {job.versions.toReversed().map((version) => (
                      <div key={version.id} className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span>Versión {version.number} · {version.profile.name} v{version.profile.version} · {version.origin === "jpeg" ? "JPEG" : "RAW"}</span>
                        <div className="flex items-center gap-2">
                          <Badge variant={version.backupStatus === "verified" ? "secondary" : version.backupStatus === "failed" ? "destructive" : "outline"}>{version.backupStatus === "verified" ? "Respaldo verificado" : version.backupStatus === "failed" ? "Respaldo fallido" : "Respaldo pendiente"}</Badge>
                          <Badge variant={version.approvalStatus === "approved" ? "default" : "outline"}>{version.approvalStatus === "approved" ? "Aprobada vigente" : version.approvalStatus === "revoked" ? "Revocada" : version.approvalStatus === "superseded" ? "Reemplazada" : "En revisión"}</Badge>
                          {version.approvalStatus !== "approved" && (
                            <Button size="xs" variant="secondary" disabled={busy} onClick={() => transition(`/api/editing/${job.id}/approve`, { versionId: version.id })}>Aprobar versión {version.number}</Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs text-muted-foreground">El resultado es derivado; RAW y JPEG originales permanecen intactos. Corrección de lente: {job.lensCorrectionApplied ? "aplicada" : "sin datos utilizables"}.</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button variant="outline" disabled={busy} onClick={() => transition(`/api/editing/${job.id}/reprocess`)}>Reprocesar</Button>
                      {event.editingProfile.version !== job.profile.version && (
                        <Button variant="outline" disabled={busy} onClick={() => transition(`/api/editing/${job.id}/reprocess-current-profile`)}>
                          Reprocesar con perfil v{event.editingProfile.version}
                        </Button>
                      )}
                      {job.status === "review" && currentVersion && (
                        <Button disabled={busy} onClick={() => transition(`/api/editing/${job.id}/approve`, { versionId: currentVersion.id })}>Aprobar edición</Button>
                      )}
                      {approvedVersion && (
                        <Button variant="outline" disabled={busy} onClick={() => transition(`/api/editing/${job.id}/revoke`)}>Revocar aprobación</Button>
                      )}
                    </div>
                  </div>
                  {approvedVersion?.deliveryStatus === "ready" && (
                    <Alert><Check /><AlertTitle>Edición aprobada y lista para entrega</AlertTitle><AlertDescription>JPEG sRGB completo validado: {approvedVersion.width} × {approvedVersion.height}px.</AlertDescription></Alert>
                  )}
                  {approvedVersion?.deliveryStatus === "failed" && (
                    <Alert variant="destructive"><CircleAlert /><AlertTitle>JPEG completo pendiente</AlertTitle><AlertDescription>{approvedVersion.deliveryError}</AlertDescription><Button size="sm" onClick={() => transition(`/api/editing/${job.id}/retry-delivery`)}>Reintentar JPEG completo</Button></Alert>
                  )}
                  {alternatives.length > 0 && (
                    <div className="grid gap-2 rounded-lg border border-border p-3">
                      <p className="text-xs font-semibold">Alternativas seleccionadas</p>
                      {alternatives.map((alternative) => (
                        <div key={alternative.id} className="flex flex-wrap items-center justify-between gap-2 text-xs">
                          <span>{alternative.baseName}</span>
                          <div className="flex gap-2">
                            <Button size="xs" variant="outline" disabled={busy} onClick={() => transition(`/api/editing/${job.id}/alternatives/${alternative.id}/process`)}>Procesar alternativa</Button>
                            <Button size="xs" disabled={busy} onClick={() => transition(`/api/editing/${job.id}/principal/${alternative.id}`)}>Usar como principal</Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              )}

              {!previewAvailable && (
                <CardContent className="flex flex-wrap justify-end gap-2">
                  {(job.status === "queued" || job.status === "processing") && (
                    <Button variant="outline" disabled={busy} onClick={() => transition(`/api/editing/${job.id}/cancel`)}>
                      Cancelar edición
                    </Button>
                  )}
                  {(job.status === "failed" || job.status === "interrupted" || job.status === "cancelled") && (
                    <Button disabled={busy} onClick={() => transition(`/api/editing/${job.id}/retry`)}>
                      Reintentar edición
                    </Button>
                  )}
                </CardContent>
              )}
            </Card>
          )
        })}
      </div>
    </section>
  )
}
