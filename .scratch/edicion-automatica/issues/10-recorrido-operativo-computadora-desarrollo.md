# 10 — Completar el recorrido operativo en la computadora de desarrollo

**What to build:** integrar todas las capacidades de Edición automática en un recorrido recuperable y medible que funcione primero en la computadora de desarrollo secundaria, usando GPU cuando sea adecuado y conservando una ruta funcional por CPU.

**Blocked by:** 02 — Hacer persistente y recuperable la cola de edición; 03 — Revelar Sony ARW y autorizar la alternativa JPEG; 04 — Aplicar el perfil Natural de evento y ajustes manuales; 05 — Gestionar versiones, reprocesamiento y aprobación; 06 — Generar el JPEG completo listo para entrega; 07 — Añadir detección facial y suavizado de piel; 08 — Respaldar resultados y proteger el almacenamiento.

**Status:** completed

- [x] El recorrido integral funciona en Windows 10 Pro con Intel Core i7-10700K, 16 GB de RAM y NVIDIA GeForce RTX 3060 de 12 GB.
- [x] La ruta acelerada usa GPU cuando aporta valor y la ruta por CPU conserva funcionalidad con una advertencia de menor rendimiento.
- [x] El operador puede completar captura simulada o importada, selección principal, edición, comparación, ajuste, aprobación, JPEG completo y respaldo.
- [x] Nuevas sesiones fotográficas continúan operativas mientras se procesa una edición anterior.
- [x] Un cierre inesperado en puntos representativos recupera trabajos, versiones, parámetros y aprobación sin aceptar archivos parciales.
- [x] La interfaz muestra una advertencia cuando la vista previa supera 30 segundos y permite continuar con otras tareas.
- [x] Las métricas locales separan tiempo hasta vista previa, tiempo hasta JPEG completo, ruta CPU/GPU, fallos y reintentos sin registrar fotografías ni información privada.
- [x] Las mediciones en esta computadora quedan registradas como referencia de desarrollo y no sustituyen la validación posterior de la computadora objetivo.
- [x] El recorrido automatizado verifica comportamiento observable mediante la aplicación completa y material controlado.
- [x] No se añade una pantalla de QA ni se ejecuta inspección visual manual hasta que el usuario lo solicite explícitamente.
- [x] El módulo termina en `Edición aprobada y lista para entrega` sin generar QR, impresión, mensajes desde iPad ni libro digital.
- [x] Todos los criterios de la especificación están cubiertos por un incremento o vinculados a una limitación documentada y aprobada.
