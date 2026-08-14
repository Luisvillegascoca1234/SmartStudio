# 10 — Optimizar y validar el P95 en la laptop objetivo

**What to build:** ajustar el proveedor visualmente aprobado y su trabajador para que el fondo automático mantenga el objetivo global de vista previa en la computadora objetivo, conservando una ruta CPU funcional y la calidad seleccionada.

**Blocked by:** 09 — Calibrar visualmente y seleccionar el proveedor.

**Status:** ready-for-agent

- [ ] Las mediciones separan warm-up, segmentación, refinamiento, composición y tiempo total hasta la vista previa.
- [ ] El benchmark usa al menos 20 trabajos representativos y reporta muestra, mediana, P95, fallos y ruta efectiva.
- [ ] La medición principal se ejecuta en la laptop objetivo con RTX 5050; la computadora de desarrollo solo aporta datos preliminares.
- [ ] La configuración aprobada mantiene el objetivo global de que al menos el 95 % de las vistas previas estén disponibles en 30 segundos o menos.
- [ ] La ruta CPU completa y válida se mide por separado aunque pueda superar el objetivo de la GPU.
- [ ] Las optimizaciones no cambian el checkpoint, degradan el matte aprobado ni reducen la precisión efectiva del compositor.
- [ ] El informe no afirma uso de GPU solo por disponibilidad: registra evidencia de que CUDA ejecutó la inferencia.
- [ ] Si no se alcanza el objetivo, la activación queda bloqueada y el informe identifica la etapa dominante.
