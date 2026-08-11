# 11 — Alinear rawpy y JPEG de emergencia con Evento pulido

**What to build:** hacer que las rutas rawpy y JPEG de emergencia produzcan versiones claramente identificadas, reproducibles y sujetas a los mismos límites obligatorios y decisiones editoriales de Evento pulido.

**Blocked by:** 10 — Aprobar o rechazar desde el mismo máster.

**Status:** completed

- [x] Un fallo utilizable de darktable activa rawpy como respaldo local y registra motor, versión, parámetros efectivos y advertencia de aceleración o calidad.
- [x] Un RAW ausente, corrupto o incompatible mantiene la autorización explícita antes de procesar desde JPEG.
- [x] La versión distingue inequívocamente RAW revelado por darktable, RAW revelado por rawpy y origen JPEG.
- [x] Las rutas de respaldo producen un máster validado y derivan preview y entrega del mismo máster sin JPEG intermedios adicionales.
- [x] Piel, ojos, dientes, iluminación facial, fondo y límites obligatorios mantienen el mismo comportamiento observable cuando la entrada lo permite.
- [x] Las diferencias visuales conocidas del respaldo se muestran como advertencia y no se ocultan como equivalencia con darktable.
- [x] Rechazar el fallback JPEG o su resultado conserva originales y no publica una entrega.
- [x] Verificaciones cubren darktable no disponible, rawpy exitoso, rawpy fallido, JPEG autorizado, JPEG rechazado y recuperación posterior.
