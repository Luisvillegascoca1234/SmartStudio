# 04 — Recorrer SmartStudio-Natural con un Adobe controlado

**What to build:** completar desde la interfaz el primer recorrido Adobe verificable mediante el ejecutable controlado acordado, conservando SmartStudio como fuente de verdad y sin requerir Photoshop real en las pruebas automatizadas.

**Blocked by:** 02 — Distinguir motores de Edición automática; 03 — Comprobar preparación Adobe y ofrecer recuperación explícita.

**Status:** completed

- [x] Finalizar una sesión fotográfica crea automáticamente un trabajo Adobe para la fotografía principal.
- [x] SmartStudio prepara una copia de trabajo identificada sin modificar el RAW ni el JPEG originales.
- [x] `SmartStudio-Natural` es la automatización predeterminada y procesa un trabajo a la vez.
- [x] El ejecutable controlado recibe el trabajo mediante el mismo contrato de proceso y archivos previsto para el Droplet real.
- [x] Una salida JPEG sRGB completa se valida por legibilidad, dimensiones, asociación y metadatos permitidos.
- [x] SmartStudio deriva la vista previa del mismo JPEG completo y permite compararla, ampliarla y desplazarla.
- [x] Aprobar la vista previa declara vigente ese mismo JPEG sin ejecutar nuevamente el motor.
- [x] La versión registra motor Adobe, origen RAW/JPEG, perfil, parámetros y tiempos.
- [x] Las fotografías alternativas conservan su procesamiento únicamente mediante solicitud explícita.
- [x] Una prueba E2E recorre captura simulada, selección principal, procesamiento, revisión, aprobación y reinicio con directorio temporal aislado.

## Evidencia

- El contrato v1 crea copias de trabajo identificadas, `request.json`, salida completa y `result.json` asociado por token, trabajo y captura.
- SmartStudio valida JPEG/sRGB/dimensiones/metadatos, deriva la vista previa y conserva el JPEG completo antes de aprobar.
- La prueba comprobó hashes inmutables de RAW/JPEG y que aprobar no cambia el JPEG ni ejecuta otro contrato.
- `pnpm test:e2e`: 35 pruebas aprobadas.
