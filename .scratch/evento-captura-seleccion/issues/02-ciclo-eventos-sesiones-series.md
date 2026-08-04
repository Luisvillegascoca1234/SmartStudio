# 02 — Completar el ciclo de eventos, sesiones fotográficas y series

**What to build:** ampliar el recorrido mínimo para que el operador administre eventos existentes, sesiones fotográficas numeradas y múltiples series, incluyendo cancelación y restauración sin perder capturas.

**Blocked by:** 01 — Recorrer el flujo mínimo con capturas simuladas.

**Status:** completed

- [x] El operador puede reabrir un evento existente y continuar desde su último estado guardado.
- [x] Un evento admite nombre obligatorio, fecha y hora automáticas, ubicación opcional y notas opcionales.
- [x] Solo puede existir un evento operativo activo a la vez.
- [x] Cada sesión fotográfica recibe un número consecutivo, hora y una etiqueta opcional.
- [x] Solo puede existir una sesión fotográfica activa dentro del evento.
- [x] El operador inicia y cierra cada serie manualmente.
- [x] Una sesión fotográfica puede contener varias series y las fotografías anteriores permanecen disponibles.
- [x] El operador puede cancelar una sesión fotográfica sin borrar sus capturas.
- [x] El operador puede restaurar una sesión fotográfica cancelada y recuperar todas sus series.
- [x] Un reinicio en cualquier transición recupera el último estado confirmado sin mezclar eventos, sesiones fotográficas ni series.
- [x] Las verificaciones recorren desde la interfaz los ciclos normal, cancelado, restaurado e interrumpido.
