# 01 — Recorrer el flujo mínimo con capturas simuladas

**What to build:** un primer recorrido completo y demostrable donde el operador crea un evento, inicia una sesión y una serie, recibe un par RAW + JPEG desde la fuente simulada, revisa la vista previa, marca una fotografía principal y recupera el mismo estado después de reiniciar la aplicación.

**Blocked by:** None — can start immediately.

**Status:** completed

- [x] El operador puede crear un evento proporcionando al menos su nombre y obtiene fecha y hora automáticas.
- [x] El operador puede iniciar una sesión y una serie dentro del evento activo.
- [x] La fuente simulada incorpora un par RAW + JPEG controlado sin requerir la Sony A7 IV.
- [x] La interfaz muestra el JPEG como vista previa y conserva la asociación con el RAW.
- [x] El operador puede cerrar la serie, seleccionar la captura y marcarla como principal.
- [x] El estado se guarda automáticamente después de cada transición relevante.
- [x] Después de cerrar y abrir la aplicación, el evento, la sesión, la serie, la captura y la selección principal se recuperan correctamente.
- [x] Una verificación integral recorre el comportamiento completo desde la interfaz y comprueba resultados observables, no detalles internos.
- [x] El incremento no edita imágenes, genera QR, imprime ni incorpora funciones del iPad.
