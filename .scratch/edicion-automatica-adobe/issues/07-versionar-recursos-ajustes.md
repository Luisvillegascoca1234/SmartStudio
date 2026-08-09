# 07 — Versionar recursos Adobe e integrar ajustes acotados

**What to build:** permitir que un evento conserve una combinación reproducible de preset y Action mientras el operador utiliza los ajustes acotados ya confirmados y mantiene intactas las versiones anteriores.

**Blocked by:** 05 — Conectar Camera Raw y Photoshop para SmartStudio-Natural.

**Status:** completed

- [x] Cada evento fija las versiones del preset y la Action utilizadas por sus trabajos futuros.
- [x] Cada trabajo conserva una instantánea de esa combinación y no cambia cuando se instalan recursos posteriores.
- [x] Exposición, temperatura, intensidad de color y suavizado de piel se aplican dentro de los límites ya confirmados.
- [x] La vista previa y el JPEG completo reflejan exactamente los mismos recursos y ajustes.
- [x] Restablecer vuelve a la edición automática de la versión actual sin modificar originales ni otras versiones.
- [x] `Reprocesar` crea una versión nueva y conserva la versión anterior, su origen y su aprobación.
- [x] Actualizar preset o Action afecta trabajos futuros; adoptar la actualización en una fotografía anterior requiere reprocesamiento explícito.
- [x] Reiniciar conserva recursos, parámetros, asociaciones y versiones sin depender de la configuración Adobe más reciente.
- [x] Las verificaciones E2E cubren ajustes, restablecimiento, actualización de recursos y reprocesamiento observable.

## Evidencia

- `tests/e2e/adobe-resource-versioning.spec.ts` cubre instantáneas, límites, ajustes, restablecimiento, adopción, trabajos futuros y reinicio.
- El motor real archiva preset, Droplet, Action y manifiesto de la combinación antes de procesar.
- Verificación enfocada: typecheck y 4 pruebas aprobadas.
