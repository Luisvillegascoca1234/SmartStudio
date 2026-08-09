# 02 — Distinguir motores de Edición automática

**What to build:** conservar el recorrido local existente mientras SmartStudio identifica de extremo a extremo qué motor produjo cada trabajo y versión de edición, dejando un límite sustituible para la alternativa Adobe.

**Blocked by:** 01 — Preparar y verificar el entorno Adobe.

**Status:** completed

- [x] El recorrido local basado en darktable continúa funcionando sin cambios observables en captura, cola, revisión, aprobación y respaldo.
- [x] Cada trabajo y versión de edición conserva un motor de origen inequívoco y persistente.
- [x] La interfaz permite distinguir una versión local de una versión Adobe sin exponer detalles internos innecesarios.
- [x] Los estados guardados antes del cambio se recuperan como versiones locales sin perder asociaciones ni aprobaciones.
- [x] El procesamiento puede recibir un motor controlado desde el entorno de pruebas sin sustituir el servidor, la cola o la persistencia reales.
- [x] Reiniciar conserva el motor registrado y no mezcla resultados entre motores.
- [x] Las pruebas E2E existentes permanecen aprobadas y un recorrido nuevo demuestra la identificación del motor desde la interfaz.

## Evidencia

- Se añadió un contrato sustituible para motores, con el motor local como implementación predeterminada.
- El estado v11 persiste el motor en trabajos y versiones; la migración asigna `local` a estados anteriores.
- La interfaz muestra `Motor local` o `Motor Adobe` tanto en el trabajo como en cada versión.
- `pnpm typecheck` y la suite completa `pnpm test:e2e` aprobaron; resultado: 32 pruebas E2E aprobadas.
