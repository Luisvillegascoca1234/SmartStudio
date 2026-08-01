# 03 — Hacer robusta la recepción e importación de capturas

**What to build:** permitir que las capturas simuladas o importadas manualmente entren al mismo flujo aunque RAW y JPEG lleguen en distinto orden, mostrando estados comprensibles y conservando siempre los originales.

**Blocked by:** 02 — Completar el ciclo de eventos, sesiones y series.

**Status:** completed

- [x] La importación simulada y la importación manual producen el mismo comportamiento visible para el operador.
- [x] Un JPEG que llega primero aparece como vista previa y muestra que su RAW está pendiente.
- [x] Un RAW que llega primero permanece asociado y completa el par cuando llega el JPEG.
- [x] El operador puede importar pares RAW + JPEG desde una carpeta de respaldo.
- [x] Una captura cuyo RAW no llega queda identificada como incompleta sin desaparecer de la sesión.
- [x] El estado conserva la posibilidad de autorizar posteriormente un procesamiento de emergencia desde JPEG.
- [x] El operador puede excluir una captura de la revisión sin borrar ni modificar sus archivos.
- [x] Los RAW y JPEG originales permanecen inmutables durante importación, exclusión y recuperación.
- [x] Los archivos incompletos o no reconocidos generan una advertencia y no dañan el resto de la serie.
- [x] Las verificaciones cubren ambos órdenes de llegada, archivos pendientes, importación manual, exclusión y reinicio.
