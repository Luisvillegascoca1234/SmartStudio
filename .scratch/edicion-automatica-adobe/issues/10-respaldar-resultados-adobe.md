# 10 — Respaldar y proteger resultados Adobe

**What to build:** integrar JPEG, PSD, recursos, parámetros y aprobaciones de la alternativa Adobe con el respaldo verificado y las reglas de almacenamiento existentes.

**Blocked by:** 08 — Crear SmartStudio-Fondo como versión explícita; 09 — Corregir manualmente una versión en Photoshop.

**Status:** completed

- [x] JPEG completos, vistas previas, PSD necesarios, parámetros, recursos versionados y aprobaciones forman parte del respaldo del evento.
- [x] Cada resultado muestra si su copia al SSD está verificada, pendiente o fallida.
- [x] Un fallo o desconexión del SSD no elimina resultados ni detiene automáticamente la edición cuando existe espacio interno seguro.
- [x] Recuperar el SSD permite reintentar y verificar el respaldo pendiente.
- [x] El espacio interno crítico impide iniciar nuevos trabajos Adobe y nuevas correcciones manuales antes de producir archivos incompletos.
- [x] Un PSD se conserva durante el evento y hasta confirmar su respaldo al SSD.
- [x] Revocar o sustituir una aprobación actualiza el resultado vigente sin eliminar automáticamente versiones respaldadas.
- [x] Reiniciar conserva el estado de respaldo de cada artefacto Adobe.
- [x] Las verificaciones cubren SSD correcto, desconexión, copia fallida, recuperación, espacio bajo y espacio crítico.

## Evidencia

- `tests/e2e/adobe-backup-protection.spec.ts` cubre artefactos Adobe, PSD, estado/aprobación, desconexión, recuperación, espacio seguro y crítico.
- `tests/e2e/editing-backup.spec.ts` conserva la regresión de copia fallida y recuperación.
- Verificación enfocada: typecheck, build y 2 pruebas aprobadas.
