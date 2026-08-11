# 01 — Activar Evento pulido para trabajos nuevos

**What to build:** hacer que cada trabajo nuevo de edición use automáticamente el único perfil Evento pulido, sin selección de perfil ni ajustes del operador, conservando legibles e inmutables las versiones históricas de Natural de evento.

**Blocked by:** None — can start immediately.

**Status:** completed

- [x] Una fotografía principal crea automáticamente un trabajo nuevo identificado con Evento pulido y una versión de perfil fijada.
- [x] Los trabajos nuevos no muestran controles de exposición, temperatura, intensidad de color, suavizado ni selección de perfil o intensidad.
- [x] El operador conserva comparación antes/después, ampliación, desplazamiento, aprobación, rechazo, revocación y reintento de errores técnicos.
- [x] El rechazo editorial se distingue de un fallo técnico, una cancelación y el rechazo del fallback JPEG, y no deja la fotografía lista para entrega.
- [x] Reintentar un error técnico reutiliza la receta fijada y no funciona como ajuste editorial.
- [x] Las versiones históricas de Natural de evento y sus parámetros permanecen legibles, visibles e inmutables después de la migración.
- [x] Un recorrido E2E demuestra el flujo automático de un trabajo nuevo y la ausencia de controles manuales sin alterar el original.
