# 09 — Respaldar resultados y proteger el almacenamiento

**What to build:** integrar trabajos, versiones, parámetros y JPEG completos con el respaldo externo y las reglas de espacio existentes, para continuar operando sin asumir que un resultado está protegido cuando la copia falla.

**Blocked by:** 02 — Hacer persistente y recuperable la cola de edición; 06 — Generar el JPEG completo listo para entrega.

**Status:** completed

- [x] Las vistas previas necesarias, versiones, parámetros, aprobaciones y JPEG completos se incorporan al respaldo del evento.
- [x] Cada copia se verifica mediante el mismo criterio de integridad usado por el módulo actual antes de mostrarse como respaldada.
- [x] Un fallo o desconexión del SSD no elimina resultados ni detiene automáticamente el procesamiento interno.
- [x] Un resultado sin copia verificada muestra `Respaldo pendiente` y puede reintentarse después de recuperar el SSD.
- [x] Reiniciar la aplicación conserva cuáles resultados están verificados, pendientes o fallidos.
- [x] El espacio interno bajo genera una advertencia y permite continuar mientras exista margen seguro.
- [x] El espacio crítico impide iniciar nuevos trabajos de edición.
- [x] Un trabajo activo solo puede terminar con espacio crítico cuando existe margen comprobado para producir y guardar el resultado.
- [x] La limpieza nunca elimina automáticamente versiones u originales durante el evento.
- [x] Las verificaciones cubren SSD correcto, desconectado, copia fallida, recuperación, espacio bajo y espacio crítico sin realizar QA manual dentro de la aplicación.
