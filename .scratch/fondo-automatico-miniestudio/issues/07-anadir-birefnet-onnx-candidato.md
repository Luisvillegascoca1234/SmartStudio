# 07 — Añadir BiRefNet como proveedor ONNX candidato

**What to build:** ejecutar un modelo BiRefNet de retrato o variante ligera como proveedor local candidato dentro del reemplazo real de fondo, usando GPU NVIDIA cuando sea posible y conservando MediaPipe y CPU como alternativas automáticas.

**Blocked by:** 05 — Reemplazar automáticamente mediante la placa limpia; 06 — Mantener un trabajador de visión caliente y recuperable.

**Status:** completed

- [x] El checkpoint candidato tiene licencia, origen, versión, hash y requisitos documentados antes de utilizarse.
- [x] El modelo y su caché permanecen fuera de Git y no requieren una descarga durante el evento.
- [x] ONNX Runtime prioriza CUDA y conserva CPU como respaldo en orden explícito.
- [x] La sesión BiRefNet se mantiene caliente dentro del trabajador y no se carga de nuevo por fotografía.
- [x] El proveedor entrega el mismo contrato de matte que MediaPipe y participa en el flujo completo de reemplazo.
- [x] La ruta efectiva GPU o CPU y cualquier fallback quedan registrados en el trabajo.
- [x] La selección del candidato es técnica y versionada; no aparece como opción del operador.
- [x] Un fallo de CUDA recurre automáticamente a CPU o MediaPipe sin publicar un resultado parcial.
- [x] Pruebas de integración verifican carga, inferencia, fallback y composición completa con el proveedor candidato.
