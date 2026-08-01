# 02 — Completar el ciclo de eventos, sesiones y series

**What to build:** ampliar el recorrido mínimo para que el operador administre eventos existentes, sesiones numeradas y múltiples series, incluyendo cancelación y restauración sin perder capturas.

**Blocked by:** 01 — Recorrer el flujo mínimo con capturas simuladas.

**Status:** ready-for-agent

- [ ] El operador puede reabrir un evento existente y continuar desde su último estado guardado.
- [ ] Un evento admite nombre obligatorio, fecha y hora automáticas, ubicación opcional y notas opcionales.
- [ ] Solo puede existir un evento operativo activo a la vez.
- [ ] Cada sesión recibe un número consecutivo, hora y una etiqueta opcional.
- [ ] Solo puede existir una sesión activa dentro del evento.
- [ ] El operador inicia y cierra cada serie manualmente.
- [ ] Una sesión puede contener varias series y las fotografías anteriores permanecen disponibles.
- [ ] El operador puede cancelar una sesión sin borrar sus capturas.
- [ ] El operador puede restaurar una sesión cancelada y recuperar todas sus series.
- [ ] Un reinicio en cualquier transición recupera el último estado confirmado sin mezclar eventos, sesiones ni series.
- [ ] Las verificaciones recorren desde la interfaz los ciclos normal, cancelado, restaurado e interrumpido.
