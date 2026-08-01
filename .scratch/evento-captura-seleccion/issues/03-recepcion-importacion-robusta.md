# 03 — Hacer robusta la recepción e importación de capturas

**What to build:** permitir que las capturas simuladas o importadas manualmente entren al mismo flujo aunque RAW y JPEG lleguen en distinto orden, mostrando estados comprensibles y conservando siempre los originales.

**Blocked by:** 02 — Completar el ciclo de eventos, sesiones y series.

**Status:** ready-for-agent

- [ ] La importación simulada y la importación manual producen el mismo comportamiento visible para el operador.
- [ ] Un JPEG que llega primero aparece como vista previa y muestra que su RAW está pendiente.
- [ ] Un RAW que llega primero permanece asociado y completa el par cuando llega el JPEG.
- [ ] El operador puede importar pares RAW + JPEG desde una carpeta de respaldo.
- [ ] Una captura cuyo RAW no llega queda identificada como incompleta sin desaparecer de la sesión.
- [ ] El estado conserva la posibilidad de autorizar posteriormente un procesamiento de emergencia desde JPEG.
- [ ] El operador puede excluir una captura de la revisión sin borrar ni modificar sus archivos.
- [ ] Los RAW y JPEG originales permanecen inmutables durante importación, exclusión y recuperación.
- [ ] Los archivos incompletos o no reconocidos generan una advertencia y no dañan el resto de la serie.
- [ ] Las verificaciones cubren ambos órdenes de llegada, archivos pendientes, importación manual, exclusión y reinicio.
