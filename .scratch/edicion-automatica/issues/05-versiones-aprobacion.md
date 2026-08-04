# 05 — Gestionar versiones, reprocesamiento y aprobación

**What to build:** permitir que el operador conserve varias versiones derivadas, reprocesarlas, elegir cuál está aprobada y mantener decisiones coherentes cuando cambia la fotografía principal o se procesa una alternativa.

**Blocked by:** 02 — Hacer persistente y recuperable la cola de edición; 04 — Aplicar el perfil Natural de evento y ajustes manuales.

**Status:** completed

- [x] Cada versión registra número, fecha, perfil, parámetros, origen RAW/JPEG y estado de aprobación.
- [x] `Reprocesar` crea una versión nueva sin sobrescribir la versión anterior.
- [x] El operador puede aprobar una versión y distinguirla inequívocamente de las demás.
- [x] El operador puede revocar una aprobación y volver al estado de revisión sin borrar la versión.
- [x] El operador puede reabrir una edición aprobada y producir otra versión manteniendo vigente la aprobación anterior hasta reemplazarla.
- [x] Solo una versión de una fotografía puede ser la aprobada vigente.
- [x] Cambiar la fotografía principal invalida el resultado vigente de la sesión fotográfica, conserva sus versiones y solicita procesar la nueva principal.
- [x] Las fotografías alternativas se procesan solo mediante una acción explícita y mantienen versiones y aprobaciones independientes.
- [x] Las versiones no se eliminan automáticamente durante el evento.
- [x] Reiniciar la aplicación conserva versiones, parámetros, asociaciones y aprobación vigente.
- [x] Las verificaciones recorren reprocesamiento, aprobación, revocación, reapertura, cambio de principal y alternativa desde la interfaz.
