# 02 — Hacer persistente y recuperable la cola de edición

**What to build:** convertir el primer trabajo de edición en una cola operativa que procesa una fotografía a la vez, no bloquea nuevas sesiones fotográficas y se recupera con estados comprensibles después de cancelaciones, fallos o reinicios.

**Blocked by:** 01 — Mostrar la primera edición automática de la fotografía principal.

**Status:** completed

- [x] Los trabajos se procesan de uno en uno y respetan el orden de llegada.
- [x] La interfaz identifica evento, sesión fotográfica, fotografía, estado y tiempo transcurrido de cada trabajo.
- [x] Una fotografía y una versión del perfil no crean trabajos duplicados por acciones repetidas.
- [x] El operador puede cancelar un trabajo sin modificar originales ni conservar un resultado parcial como válido.
- [x] Un trabajo fallido o interrumpido puede reintentarse sin crear asociaciones ambiguas.
- [x] Un fallo no impide que los trabajos posteriores continúen cuando sea seguro.
- [x] Crear y operar nuevas sesiones fotográficas continúa disponible mientras la cola procesa imágenes anteriores.
- [x] Cerrar un evento permite terminar trabajos existentes, pero impide solicitar otros nuevos mientras permanezca cerrado.
- [x] La cola, sus parámetros y sus estados se guardan automáticamente.
- [x] Después de reiniciar, un trabajo que estaba procesando aparece como interrumpido y reintentable; nunca como completado por un archivo parcial.
- [x] Las verificaciones recorren orden, idempotencia, cancelación, fallo, reintento, evento cerrado y recuperación desde la interfaz.
