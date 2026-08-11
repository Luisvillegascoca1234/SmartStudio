# 09 — Aplicar límites obligatorios y omisión selectiva

**What to build:** hacer observable que Evento pulido aplica todas las correcciones seguras, omite independientemente las regiones inciertas y nunca supera los límites que protegen identidad, geometría, tono natural y rasgos permanentes.

**Blocked by:** 08 — Integrar el completado de fondo con el máster.

**Status:** completed

- [x] Cada operación de piel, ojos, dientes, iluminación facial y fondo registra si fue aplicada u omitida y la causa de una omisión.
- [x] La interfaz resume las advertencias sin exigir que el operador configure parámetros o máscaras.
- [x] Una fotografía sin rostro conserva la corrección fotográfica global y no se clasifica como fallo técnico.
- [x] Una fotografía parcialmente incierta conserva las operaciones seguras y omite únicamente las regiones afectadas.
- [x] Las verificaciones demuestran que no cambian facciones, cuerpo, geometría ocular, color del iris, dirección de mirada, tono natural de piel ni rasgos permanentes.
- [x] Las verificaciones demuestran que el motor no inventa piel, ojos, dientes, cabello, personas, objetos o escenas.
- [x] Los límites no pueden desactivarse desde la interfaz ni mediante las acciones normales del operador.
- [x] Repetir el mismo trabajo con la misma receta y recursos conserva decisiones de aplicación u omisión reproducibles.
- [x] Un recorrido E2E reúne corrección global, retoque parcial, advertencias y revisión en una fotografía controlada.
