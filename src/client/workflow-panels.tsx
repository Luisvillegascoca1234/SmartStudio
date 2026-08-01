import type { ReactNode } from "react"
import { Check } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { PhotoSession, Series } from "../shared/workflow.js"

export function Step({ number, label, complete }: { number: string; label: string; complete: boolean }) {
  return (
    <div className={cn("relative flex min-h-16 flex-col items-center gap-1 text-xs text-muted-foreground lg:flex-row lg:gap-3 lg:text-sm", complete && "text-primary")}>
      <span className={cn("grid size-8 shrink-0 place-items-center rounded-full border border-border bg-background text-[11px] font-semibold", complete && "border-primary bg-primary text-primary-foreground")}>
        {complete ? <Check className="size-4" /> : number}
      </span>
      <p className="font-medium">{label}</p>
      <span className="absolute left-4 top-12 hidden h-5 w-px bg-border lg:block last:hidden" />
    </div>
  )
}

export function ActionCard({ title, copy, icon, children }: { title: string; copy: string; icon: ReactNode; children: ReactNode }) {
  return (
    <Card size="sm" className="border-border bg-muted/35">
      <CardHeader>
        <div className="mb-2 grid size-9 place-items-center rounded-lg bg-primary/10 text-primary [&_svg]:size-4">{icon}</div>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{copy}</CardDescription>
        <CardAction>{children}</CardAction>
      </CardHeader>
    </Card>
  )
}

export function SessionHistory({
  sessions,
  busy,
  restore,
}: {
  sessions: PhotoSession[]
  busy: boolean
  restore: (id: string) => void
}) {
  return (
    <section className="mt-7">
      <h3 className="text-sm font-semibold">Historial de sesiones</h3>
      <div className="mt-3 grid gap-2">
        {sessions.toReversed().map((session) => (
          <Card key={session.id} size="sm" className="bg-background/35">
            <CardHeader>
              <CardTitle>Sesión {session.number}{session.label ? ` · ${session.label}` : ""}</CardTitle>
              <CardDescription>
                {session.series.length} serie{session.series.length === 1 ? "" : "s"} · {session.status === "cancelled" ? "Cancelada" : "Finalizada"}
              </CardDescription>
              {session.status === "cancelled" && (
                <CardAction>
                  <Button size="sm" variant="secondary" disabled={busy} onClick={() => restore(session.id)}>
                    Restaurar
                  </Button>
                </CardAction>
              )}
            </CardHeader>
            {session.series.some((series) => series.captures.length > 0) && (
              <CardContent className="flex gap-2 overflow-x-auto">
                {session.series.flatMap((series) => series.captures).map((capture) => (
                  capture.jpegRelativePath ? (
                    <img
                      key={capture.id}
                      src={`/captures/${capture.id}/preview`}
                      alt={`Captura conservada ${capture.baseName}`}
                      className="aspect-3/2 w-24 shrink-0 rounded-md object-cover"
                    />
                  ) : (
                    <div key={capture.id} aria-label={`JPEG pendiente ${capture.baseName}`} className="grid aspect-3/2 w-24 shrink-0 place-items-center rounded-md bg-muted p-2 text-center text-xs text-muted-foreground">
                      JPEG pendiente
                    </div>
                  )
                ))}
              </CardContent>
            )}
          </Card>
        ))}
      </div>
    </section>
  )
}

export function PreviousSeries({ series }: { series: Series[] }) {
  return (
    <section className="mt-8 border-t border-border pt-6">
      <h3 className="text-sm font-semibold">Series anteriores</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {series.toReversed().map((item) => (
          <Card key={item.id} size="sm" className="bg-background/35">
            <CardHeader>
              <CardTitle>Serie {item.number}</CardTitle>
              <CardDescription>{item.captures.length} captura{item.captures.length === 1 ? "" : "s"} conservada{item.captures.length === 1 ? "" : "s"}</CardDescription>
            </CardHeader>
            <CardContent className="flex gap-2 overflow-x-auto">
              {item.captures.map((capture) => (
                capture.jpegRelativePath ? (
                  <img
                    key={capture.id}
                    src={`/captures/${capture.id}/preview`}
                    alt={`Vista previa anterior ${capture.baseName}`}
                    className="aspect-3/2 w-24 shrink-0 rounded-md object-cover"
                  />
                ) : (
                  <div key={capture.id} aria-label={`JPEG pendiente ${capture.baseName}`} className="grid aspect-3/2 w-24 shrink-0 place-items-center rounded-md bg-muted p-2 text-center text-xs text-muted-foreground">
                    JPEG pendiente
                  </div>
                )
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  )
}
