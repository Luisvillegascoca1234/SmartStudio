import { type FormEvent, useEffect, useMemo, useState } from "react"
import {
  Camera,
  CircleAlert,
  HardDrive,
  ImageIcon,
  Save,
  Sparkles,
} from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import {
  activeEvent,
  activeSeries,
  activeSession,
  sessionIsReadyForEditing,
  type WorkflowState,
} from "../shared/workflow.js"
import { CaptureWorkspace } from "./capture-workspace.js"
import { OperationalPanel } from "./operational-panel.js"
import { useOperations } from "./use-operations.js"
import { ActionCard, SessionHistory, Step } from "./workflow-panels.js"

async function postWorkflowTransition(path: string, body?: unknown): Promise<WorkflowState> {
  const response = await fetch(path, {
    method: "POST",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const result = (await response.json()) as WorkflowState | { error: string }
  if (!response.ok) {
    throw new Error("error" in result ? result.error : "No se pudo completar la acción.")
  }
  return result as WorkflowState
}

const formatDate = (value: string): string =>
  new Intl.DateTimeFormat("es-BO", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value),
  )

const WORKFLOW_REFRESH_INTERVAL_MILLISECONDS = 750

export function App() {
  const [state, setState] = useState<WorkflowState | null>(null)
  const [eventName, setEventName] = useState("")
  const [eventLocation, setEventLocation] = useState("")
  const [eventNotes, setEventNotes] = useState("")
  const [sessionLabel, setSessionLabel] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { operations, busy: operationsBusy, configureBackup, configureSonySource, setSoundAlerts } = useOperations(setError)
  const currentEvent = useMemo(() => (state ? activeEvent(state) : null), [state])
  const currentSession = useMemo(() => (state ? activeSession(state) : null), [state])
  const series = useMemo(() => (state ? activeSeries(state) : null), [state])
  const selectionReady = useMemo(
    () => (currentSession ? sessionIsReadyForEditing(currentSession) : false),
    [currentSession],
  )

  useEffect(() => {
    const refresh = () => fetch("/api/state")
      .then(async (response) => (await response.json()) as WorkflowState)
      .then(setState)
      .catch(() => setError("No se pudo abrir el estado local."))
    void refresh()
    if (busy) return
    const interval = window.setInterval(refresh, WORKFLOW_REFRESH_INTERVAL_MILLISECONDS)
    return () => window.clearInterval(interval)
  }, [busy])

  const run = async (action: () => Promise<WorkflowState>) => {
    setBusy(true)
    setError(null)
    try {
      setState(await action())
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo completar la acción.")
    } finally {
      setBusy(false)
    }
  }

  const createEvent = (event: FormEvent) => {
    event.preventDefault()
    void run(() =>
      postWorkflowTransition("/api/events", {
        name: eventName,
        location: eventLocation,
        notes: eventNotes,
      }),
    )
  }

  if (!state) {
    return (
      <main className="grid min-h-screen place-items-center bg-background text-muted-foreground">
        Abriendo SmartStudio…
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_85%_-10%,oklch(0.27_0.035_70),transparent_38%),linear-gradient(oklch(0.13_0.012_130),oklch(0.09_0.008_130))] px-4 py-6 text-foreground sm:px-6 lg:px-10 lg:py-10">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-[0.22em] text-primary">SMARTSTUDIO · OPERADOR</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-5xl">Captura y selección</h1>
          </div>
          <Badge variant="outline" className="hidden gap-1.5 border-primary/25 bg-primary/5 px-3 py-2 text-primary sm:flex">
            <HardDrive data-icon="inline-start" />
            100% local
          </Badge>
        </header>

        <Card size="sm" className="mb-6 border-border/70 bg-card/65 backdrop-blur">
          <CardContent className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-2 font-medium text-foreground">
              {state.savedAt ? <Save className="size-3.5 text-primary" /> : <Sparkles className="size-3.5 text-primary" />}
              {state.savedAt ? "Guardado automáticamente" : "Listo para comenzar"}
            </span>
            <span className="flex items-center gap-2">
              {state.savedAt && <time>Último cambio: {formatDate(state.savedAt)}</time>}
              {operations && (
                <Button size="xs" variant="ghost" disabled={operationsBusy} onClick={() => void setSoundAlerts(!operations.soundAlertsEnabled)}>
                  Alertas sonoras: {operations.soundAlertsEnabled ? "activadas" : "desactivadas"}
                </Button>
              )}
            </span>
          </CardContent>
        </Card>

        {error && (
          <Alert variant="destructive" className="mb-6 bg-destructive/10" role="alert">
            <CircleAlert />
            <AlertTitle>No se pudo completar la acción</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {operations && (operations.backup.status === "error" || operations.backup.status === "disconnected") && (
          <Alert variant="destructive" className="mb-6 bg-destructive/10" role="alert">
            <CircleAlert />
            <AlertTitle>Problema con el respaldo externo</AlertTitle>
            <AlertDescription>{operations.backup.error} Los originales internos y la tarjeta de la cámara permanecen intactos.</AlertDescription>
          </Alert>
        )}

        {currentSession && operations?.internalStorage.level === "low" && (
          <Alert className="mb-6 border-amber-500/35 bg-amber-500/10" role="alert">
            <HardDrive />
            <AlertTitle>El espacio interno está bajo</AlertTitle>
            <AlertDescription>La sesión continúa. Finalízala normalmente y conecta o revisa el SSD antes de la siguiente.</AlertDescription>
          </Alert>
        )}
        {currentSession && operations?.internalStorage.level === "critical" && (
          <Alert variant="destructive" className="mb-6 bg-destructive/10" role="alert">
            <HardDrive />
            <AlertTitle>El espacio interno es crítico</AlertTitle>
            <AlertDescription>Puedes terminar esta sesión; no se permitirá iniciar otra sin un SSD disponible y sin errores.</AlertDescription>
          </Alert>
        )}
        {currentSession && operations?.captureSource.configured && operations.captureSource.status === "unavailable" && (
          <Alert variant="destructive" className="mb-6 bg-destructive/10" role="alert">
            <Camera />
            <AlertTitle>Carpeta de recepción Sony no disponible</AlertTitle>
            <AlertDescription>{operations.captureSource.label}. Puedes continuar con “Importar carpeta”; la sesión activa no se detiene.</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-5 lg:grid-cols-[170px_minmax(0,1fr)] lg:gap-8">
          <aside className="grid grid-cols-4 lg:block" aria-label="Progreso">
            <Step number="01" label="Evento" complete={Boolean(currentEvent)} />
            <Step number="02" label="Sesión" complete={Boolean(currentSession)} />
            <Step number="03" label="Serie" complete={Boolean(series)} />
            <Step number="04" label="Selección" complete={selectionReady} />
          </aside>

          <Card className="min-h-[540px] border-border/80 bg-card/90 shadow-2xl shadow-black/20 backdrop-blur">
            {!currentEvent && (
              <div className="grid flex-1 gap-8 px-6 py-10 lg:grid-cols-[minmax(0,1fr)_320px] lg:px-10">
              <form onSubmit={createEvent} className="flex w-full flex-col justify-center">
                <CardHeader className="px-0">
                  <CardDescription className="text-xs font-semibold tracking-[0.2em] text-primary">NUEVO EVENTO</CardDescription>
                  <CardTitle className="text-2xl sm:text-3xl">Identifica el trabajo de hoy</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 px-0">
                  <label htmlFor="event-name" className="text-sm font-medium">Nombre del evento</label>
                  <Input
                    id="event-name"
                    value={eventName}
                    onChange={(event) => setEventName(event.target.value)}
                    placeholder="Ej. Boda Ana y Luis"
                    className="h-11 bg-background/70"
                    autoFocus
                  />
                  <label htmlFor="event-location" className="mt-2 text-sm font-medium">Ubicación <span className="font-normal text-muted-foreground">(opcional)</span></label>
                  <Input
                    id="event-location"
                    value={eventLocation}
                    onChange={(event) => setEventLocation(event.target.value)}
                    placeholder="Ej. Salón Los Jardines"
                    className="h-11 bg-background/70"
                  />
                  <label htmlFor="event-notes" className="mt-2 text-sm font-medium">Notas <span className="font-normal text-muted-foreground">(opcional)</span></label>
                  <Input
                    id="event-notes"
                    value={eventNotes}
                    onChange={(event) => setEventNotes(event.target.value)}
                    placeholder="Información útil para el operador"
                    className="h-11 bg-background/70"
                  />
                  <Button disabled={busy} type="submit" size="lg" className="mt-1 h-11">
                    Crear evento
                  </Button>
                  <p className="text-center text-xs text-muted-foreground">La fecha y hora se registran automáticamente.</p>
                </CardContent>
              </form>
              <section className="border-t border-border pt-6 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
                <h2 className="text-sm font-semibold">Eventos anteriores</h2>
                <p className="mt-1 text-xs text-muted-foreground">Puedes reabrir uno cuando no exista otro activo.</p>
                <div className="mt-4 grid gap-3">
                  {state.events.length === 0 && <p className="text-sm text-muted-foreground">Todavía no hay eventos.</p>}
                  {state.events.toReversed().map((event) => (
                    <Card key={event.id} size="sm" className="bg-muted/25">
                      <CardHeader>
                        <CardTitle>{event.name}</CardTitle>
                        <CardDescription>{formatDate(event.createdAt)} · {event.sessions.length} sesión{event.sessions.length === 1 ? "" : "es"}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <Button size="sm" variant="secondary" onClick={() => void run(() => postWorkflowTransition(`/api/events/${event.id}/reopen`))}>
                          Reabrir evento
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
              </div>
            )}

            {currentEvent && (
              <CardContent className="p-6 sm:p-8 lg:p-10">
                <div className="event-heading flex flex-col items-start justify-between gap-4 sm:flex-row">
                  <div>
                    <p className="text-xs font-semibold tracking-[0.18em] text-primary">EVENTO RECUPERADO</p>
                    <h2 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{currentEvent.name}</h2>
                    <time className="mt-1 block text-xs text-muted-foreground">{formatDate(currentEvent.createdAt)}</time>
                    {(currentEvent.location || currentEvent.notes) && (
                      <p className="mt-2 text-sm text-muted-foreground">{[currentEvent.location, currentEvent.notes].filter(Boolean).join(" · ")}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="font-mono">{currentEvent.id.slice(0, 8).toUpperCase()}</Badge>
                    {!currentSession && (
                      <Button size="sm" variant="outline" onClick={() => void run(() => postWorkflowTransition("/api/events/close"))}>
                        Cerrar evento
                      </Button>
                    )}
                  </div>
                </div>
                <Separator className="my-7" />

                {!currentSession && (
                  <>
                    <OperationalPanel
                      operations={operations}
                      busy={busy || operationsBusy}
                      configureBackup={(directory) => void configureBackup(directory)}
                      configureSonySource={(directory) => void configureSonySource(directory)}
                    />
                    <ActionCard title="La cabina está preparada" copy="Inicia la única sesión activa del evento." icon={<Camera />}>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <Input
                          aria-label="Etiqueta de la sesión"
                          value={sessionLabel}
                          onChange={(event) => setSessionLabel(event.target.value)}
                          placeholder="Etiqueta opcional"
                          className="h-8 w-44 bg-background"
                        />
                        <Button disabled={busy || operationsBusy || !operations || operations.blocksNewSession} onClick={() => void run(() => postWorkflowTransition("/api/sessions", { label: sessionLabel }))}>
                          Iniciar sesión
                        </Button>
                      </div>
                    </ActionCard>
                    {currentEvent.sessions.length > 0 && (
                      <SessionHistory
                        sessions={currentEvent.sessions}
                        busy={busy}
                        restore={(id) => void run(() => postWorkflowTransition(`/api/sessions/${id}/restore`))}
                      />
                    )}
                  </>
                )}

                {currentSession && !series && (
                  <ActionCard title={`Sesión ${currentSession.number} activa`} copy={currentSession.label ?? "Abre una serie corta antes de comenzar a capturar."} icon={<ImageIcon />}>
                    <div className="flex gap-2">
                      <Button variant="outline" disabled={busy} onClick={() => void run(() => postWorkflowTransition("/api/sessions/cancel"))}>Cancelar sesión</Button>
                      <Button disabled={busy} onClick={() => void run(() => postWorkflowTransition("/api/series"))}>
                        Iniciar serie
                      </Button>
                    </div>
                  </ActionCard>
                )}

                {series && currentSession && (
                  <CaptureWorkspace
                    series={series}
                    session={currentSession}
                    busy={busy}
                    transition={(path, body) => void run(() => postWorkflowTransition(path, body))}
                    execute={(action) => void run(action)}
                    reportError={setError}
                  />
                )}
              </CardContent>
            )}
          </Card>
        </div>
      </div>
    </main>
  )
}
