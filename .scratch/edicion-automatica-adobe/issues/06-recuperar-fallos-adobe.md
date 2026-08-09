# 06 — Recuperar fallos, demoras e interrupciones de Adobe

**What to build:** mantener la cola comprensible y recuperable cuando el proceso externo demora, falla, se bloquea, termina tarde o SmartStudio se cierra durante la edición.

**Blocked by:** 04 — Recorrer SmartStudio-Natural con un Adobe controlado.

**Status:** completed

- [x] Una demora superior a 30 segundos muestra una advertencia sin bloquear nuevas sesiones fotográficas.
- [x] El límite inicial de dos minutos marca el trabajo como interrumpido y reintentable en vez de esperar indefinidamente.
- [x] El operador puede cancelar un trabajo en cola o procesando sin aceptar resultados parciales.
- [x] Un trabajo fallido, interrumpido o cancelado puede reintentarse sin producir asociaciones ni versiones duplicadas.
- [x] Reiniciar durante el procesamiento recupera el trabajo como interrumpido y nunca como completado.
- [x] Una salida tardía, ilegible, incompleta o asociada con otro trabajo se aísla y no se convierte en versión válida.
- [x] Un fallo no impide que los trabajos posteriores continúen cuando Photoshop queda disponible.
- [x] Las métricas registran demora, fallos y reintentos sin conservar información privada de la fotografía.
- [x] El seam controlado cubre éxito tardío, timeout, bloqueo, error de proceso, archivo inválido, cancelación, reintento y reinicio.

## Evidencia

- `tests/e2e/adobe-failure-recovery.spec.ts`: demora, timeout, salida tardía, bloqueo, cancelación, continuidad, reintento, errores de proceso/archivo/asociación y reinicio.
- `tests/e2e/editing-queue-recovery.spec.ts`: regresión de cola local, cancelación y recuperación.
- Verificación combinada: 6 pruebas aprobadas.
