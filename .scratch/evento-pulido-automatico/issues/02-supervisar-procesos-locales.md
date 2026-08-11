# 02 — Supervisar los procesos locales del motor

**What to build:** impedir que darktable, reveladores de respaldo o procesos locales de análisis y retoque bloqueen indefinidamente la cola, ofreciendo timeout, cancelación efectiva y recuperación observable.

**Blocked by:** None — can start immediately.

**Status:** completed

- [x] Cada tipo de proceso externo usa un timeout explícito y apropiado para su etapa.
- [x] Cancelar un trabajo activo termina el proceso y su árbol de procesos en Windows sin dejar procesos huérfanos.
- [x] Un timeout o cancelación elimina resultados parciales y produce un estado comprensible y reintentable.
- [x] La captura de salida estándar y de error tiene límites para evitar crecimiento indefinido de memoria.
- [x] El diagnóstico registra etapa, duración, código de salida y causa de terminación sin registrar datos fotográficos privados.
- [x] Después de un proceso bloqueado, cancelado o fallido, el siguiente trabajo de la cola puede comenzar.
- [x] Las verificaciones usan procesos controlados que terminan correctamente, fallan, exceden el timeout e ignoran inicialmente la cancelación.
