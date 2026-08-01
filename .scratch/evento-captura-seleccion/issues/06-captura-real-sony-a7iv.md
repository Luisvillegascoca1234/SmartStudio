# 06 — Recibir una captura real desde la Sony A7 IV

**What to build:** incorporar una captura RAW + JPEG tomada con la Sony A7 IV conectada por USB al mismo recorrido de evento, sesión, serie y selección que ya funciona con la fuente simulada.

**Blocked by:** 05 — Proteger el evento con verificación y respaldo.

**Status:** ready-for-agent

- [ ] Se investiga y documenta el mecanismo local soportado para transferir capturas desde la Sony A7 IV en Windows antes de comprometer la integración.
- [ ] La cámara permanece configurada para RAW + JPEG y RAW con compresión sin pérdidas L.
- [ ] La tarjeta de la cámara conserva los archivos originales durante la transferencia.
- [ ] Al menos un par RAW + JPEG real llega por USB a una sesión y serie activas.
- [ ] El JPEG aparece como vista previa y el RAW queda asociado usando los mismos estados visibles que la fuente simulada.
- [ ] Una desconexión genera una advertencia y permite continuar mediante la importación desde carpeta.
- [ ] La integración no modifica las reglas de sesiones, series, selección, persistencia ni respaldo.
- [ ] La validación se realiza con la Sony A7 IV y la laptop objetivo, no únicamente con la computadora secundaria.
- [ ] Se registran limitaciones comprobadas del mecanismo de transferencia para las especificaciones posteriores.
