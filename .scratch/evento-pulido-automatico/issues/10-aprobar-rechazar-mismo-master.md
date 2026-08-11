# 10 — Aprobar o rechazar desde el mismo máster

**What to build:** completar la decisión editorial haciendo que preview y JPEG completo procedan del mismo máster retocado, con aprobación, rechazo, revocación y entrega inequívocamente asociados.

**Blocked by:** 09 — Aplicar límites obligatorios y omisión selectiva.

**Status:** completed

- [x] La preview registra el identificador y hash del máster retocado del que fue derivada.
- [x] Aprobar solicita el JPEG completo desde ese mismo máster sin volver a interpretar el RAW con una receta o entorno distinto.
- [x] La preview se comprime una sola vez y la entrega se comprime una sola vez; ninguna de las dos depende de JPEG intermedios.
- [x] El JPEG completo se valida por formato, resolución, legibilidad, asociación con el original y aprobación vigente.
- [x] El JPEG completo omite GPS y número de serie de cámara.
- [x] Rechazar el resultado conserva original, receta y derivados auditables, pero no deja una edición lista para entrega.
- [x] Revocar una aprobación retira la edición vigente sin borrar el máster ni convertir otra versión en aprobada automáticamente.
- [x] Reiniciar entre revisión, aprobación y entrega conserva la relación con el mismo máster o produce un error explícito si ese máster ya no es válido.
- [x] Un recorrido E2E cubre revisión, aprobación, entrega, rechazo, revocación y recuperación sin controles manuales.
