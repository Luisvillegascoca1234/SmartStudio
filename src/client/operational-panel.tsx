import { useState } from "react"
import { BatteryCharging, Camera, HardDrive, ShieldCheck } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import type { OperationsSnapshot } from "../shared/operations.js"

const bytesAsGiB = (bytes: number): string => `${(bytes / 1024 ** 3).toFixed(1)} GB libres`

const capacityLabel: Record<OperationsSnapshot["internalStorage"]["level"], string> = {
  sufficient: "Suficiente",
  low: "Bajo",
  critical: "Crítico",
}

const backupLabel: Record<OperationsSnapshot["backup"]["status"], string> = {
  "not-configured": "Sin configurar",
  ready: "Disponible",
  copying: "Copiando",
  verified: "Respaldado y verificado",
  error: "Falló",
  disconnected: "Desconectado",
}

type Props = {
  operations: OperationsSnapshot | null
  busy: boolean
  configureBackup: (directory: string) => void
  configureSonySource: (directory: string) => void
}

export function OperationalPanel({ operations, busy, configureBackup, configureSonySource }: Props) {
  const [backupDirectory, setBackupDirectory] = useState(operations?.backup.directory ?? "")
  const [sonyDirectory, setSonyDirectory] = useState("")

  if (!operations) return <p className="mb-5 text-sm text-muted-foreground">Comprobando el entorno operativo…</p>

  return (
    <section className="mb-6" aria-label="Verificación previa">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-semibold">Verificación previa</h3>
          <p className="text-xs text-muted-foreground">Confirma estos estados antes de recibir al siguiente grupo.</p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatusCard icon={<Camera />} title="Fuente de captura" status={operations.captureSource.status === "ready" ? "Carpeta lista" : "No disponible"} copy={operations.captureSource.label} />
        <StatusCard icon={<HardDrive />} title="Disco interno" status={capacityLabel[operations.internalStorage.level]} copy={bytesAsGiB(operations.internalStorage.freeBytes)} />
        <StatusCard icon={<ShieldCheck />} title="SSD externo" status={backupLabel[operations.backup.status]} copy={operations.backup.connected ? `${operations.backup.verifiedFiles} archivos verificados` : "Conecta y configura una carpeta del SSD"} />
        <StatusCard icon={<BatteryCharging />} title="Alimentación" status={operations.power.status === "ac" ? "Correcta" : operations.power.status === "battery" ? "Batería" : "Sin confirmar"} copy={operations.power.label} />
      </div>

      {operations.internalStorage.level === "low" && (
        <Alert className="mt-3 border-amber-500/35 bg-amber-500/10">
          <HardDrive />
          <AlertTitle>Espacio interno bajo</AlertTitle>
          <AlertDescription>Puedes continuar, pero conecta el SSD y vigila el espacio disponible.</AlertDescription>
        </Alert>
      )}
      {operations.blocksNewSession && (
        <Alert variant="destructive" className="mt-3 bg-destructive/10">
          <HardDrive />
          <AlertTitle>Espacio crítico: nueva sesión fotográfica bloqueada</AlertTitle>
          <AlertDescription>La sesión fotográfica activa puede terminarse. Para iniciar otra, conecta un SSD escribible.</AlertDescription>
        </Alert>
      )}

      <div className="mt-3 grid gap-2 rounded-lg border border-border bg-background/35 p-3 sm:grid-cols-[1fr_auto]">
        <Input aria-label="Carpeta de recepción Sony" value={sonyDirectory} onChange={(event) => setSonyDirectory(event.target.value)} placeholder="Carpeta 'Save in' de Imaging Edge Remote" />
        <Button variant="secondary" disabled={busy || sonyDirectory.trim().length === 0} onClick={() => configureSonySource(sonyDirectory)}>Conectar carpeta Sony</Button>
        <p className="text-xs text-muted-foreground sm:col-span-2">Imaging Edge Remote recibe RAW + JPEG por USB; SmartStudio incorpora los archivos estables de esa carpeta.</p>
        <Input aria-label="Ruta de carpeta del SSD" value={backupDirectory} onChange={(event) => setBackupDirectory(event.target.value)} placeholder="Ej. E:\\SmartStudio" />
        <Button variant="secondary" disabled={busy || backupDirectory.trim().length === 0} onClick={() => configureBackup(backupDirectory)}>Configurar SSD</Button>
        <p className="text-xs text-muted-foreground sm:col-span-2">La tarjeta de la cámara sigue siendo la copia original obligatoria. La laptop y el SSD son copias adicionales.</p>
      </div>
    </section>
  )
}

function StatusCard({ icon, title, status, copy }: { icon: React.ReactNode; title: string; status: string; copy: string }) {
  return (
    <Card size="sm" className="bg-muted/20">
      <CardHeader>
        <div className="flex items-center justify-between gap-2 text-primary">{icon}<Badge variant="outline">{status}</Badge></div>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{copy}</CardDescription>
      </CardHeader>
      <CardContent />
    </Card>
  )
}
