# 13 — Medir y optimizar el percentil 95

**What to build:** medir y optimizar Evento pulido en la computadora objetivo, distinguiendo el costo de cada etapa y el uso real de aceleración sin degradar la referencia visual aprobada.

**Blocked by:** 12 — Calibrar y fijar Evento pulido v1 con Sony A7 IV.

**Status:** blocked-by-12

- [x] Las métricas separan como mínimo revelado, análisis, piel, ojos y dientes, iluminación facial, fondo, exportación y tiempo total hasta preview.
- [x] La aplicación distingue OpenCL disponible, diagnóstico inconcluso y ruta efectiva conocida sin afirmar que todo el trabajo usó GPU.
- [x] Los diagnósticos de darktable y OpenCL tienen timeout y no bloquean la cola.
- [ ] Se comparan CPU, configuración automática y NVIDIA priorizada en la computadora objetivo usando el mismo conjunto de fotografías.
- [ ] Se evalúan reutilización del máster, caché derivada, análisis paralelo y carga de modelos únicamente cuando conservan resultados equivalentes.
- [ ] Cualquier optimización mantiene la receta Evento pulido v1, los límites obligatorios y la calidad visual aprobada.
- [ ] Una prueba representativa calcula percentiles sobre suficientes trabajos y registra hardware, ruta y condiciones de la medición.
- [ ] Al menos el 95 % de las previews están disponibles en 30 segundos o menos en la computadora objetivo, o el ticket documenta con evidencia el cuello de botella que impide cumplirlo.
- [x] La cola continúa permitiendo nuevas sesiones fotográficas durante la medición y no deja resultados parciales válidos ante fallos.

**Bloqueo:** la comparación CPU/automático/NVIDIA y el P95 representativo deben usar el mismo conjunto visual aprobado por el ticket 12. El reporte preliminar de la laptop objetivo se escribe fuera de Git con `pnpm benchmark:report` y rechaza como representativas muestras menores a 20 trabajos.
