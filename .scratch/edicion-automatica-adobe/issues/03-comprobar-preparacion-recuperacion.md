# 03 — Comprobar preparación Adobe y ofrecer recuperación explícita

**What to build:** permitir que el operador conozca antes de procesar si la ruta Adobe está preparada y, cuando no lo esté, continuar capturando y decidir explícitamente si utiliza la versión local.

**Blocked by:** 02 — Distinguir motores de Edición automática.

**Status:** completed

- [x] SmartStudio comprueba Photoshop estable, Camera Raw, el preset seleccionado, el Droplet, las carpetas de intercambio y los recursos requeridos para operar sin conexión continua.
- [x] La interfaz presenta un estado comprensible de preparación Adobe antes de iniciar trabajos.
- [x] Una dependencia ausente o una carpeta no escribible impide iniciar trabajos Adobe, pero no impide capturar, seleccionar ni finalizar la sesión fotográfica.
- [x] Los trabajos pendientes conservan su fotografía y quedan recuperables después de corregir la preparación.
- [x] El operador puede elegir explícitamente procesar mediante darktable cuando Adobe no esté disponible.
- [x] Rechazar la alternativa local conserva el trabajo pendiente sin fabricar un resultado.
- [x] Una versión producida mediante recuperación queda identificada como local y nunca como Adobe.
- [x] Las verificaciones cubren preparación completa, dependencias faltantes, carpetas inválidas, recuperación posterior y aceptación o rechazo de darktable.

## Evidencia

- La verificación real detectó Photoshop 2026 y Camera Raw instalados, carpetas de intercambio escribibles y señaló como pendientes el preset, Droplet, Action y manifiesto offline.
- Los trabajos Adobe no preparados quedan en `awaiting-engine-readiness`; sobreviven al reinicio y no contienen versiones fabricadas.
- La interfaz permite reintentar Adobe, conservar el trabajo pendiente o autorizar explícitamente el motor local.
- Las pruebas nuevas de preparación y recuperación aprobaron; las otras 33 pruebas de la suite aprobaron y el único conflicto de selector fue corregido y revalidado en las 2 pruebas operativas.
