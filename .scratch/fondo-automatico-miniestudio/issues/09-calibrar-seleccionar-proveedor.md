# 09 — Calibrar visualmente y seleccionar el proveedor

**What to build:** comparar el proveedor MediaPipe refinado y el candidato BiRefNet con material real autorizado del miniestudio para seleccionar una versión que mejore bordes sin modificar personas ni ampliar el alcance del fondo automático.

**Blocked by:** 08 — Endurecer fallbacks, persistencia y procedencia.

**Status:** blocked-external-validation

**Blocker (2026-08-11):** el banco local existente contiene tres casos (un retrato con flores, un retrato sobre fondo uniforme y una escena incompatible), pero no contiene placas ni referencias alpha/aceptación y no cubre cabello claro/oscuro sobre tonos similares, velos, encaje, transparencias, manos, parejas, grupos, ropa blanca/negra y accesorios. Es evidencia preliminar del completado histórico, no un banco A/B suficiente para promover MediaPipe o BiRefNet. La selección visual no puede declararse sin material real autorizado y aprobación al 100 %/tamaño normal.

- [ ] El banco externo autorizado incluye cabello claro y oscuro sobre fondos similares, velos, encaje, transparencias, manos, flores y accesorios.
- [ ] El banco incluye una persona, parejas, grupos, ropa blanca y negra, sombras, soportes, pared y fondos incompatibles.
- [ ] Cada fotografía tiene placa y referencia de aceptación asociadas mediante un manifiesto reproducible fuera de Git.
- [ ] La comparación mide calidad en banda de contorno, píxeles protegidos modificados, halos, contaminación de color, banding, reemplazos falsos y omisiones falsas.
- [ ] Todas las fotografías se inspeccionan al 100 % y a tamaño normal; las métricas no sustituyen la aprobación visual.
- [ ] El candidato solo se promueve si mejora claramente los casos difíciles sin degradar los casos seguros ni violar límites obligatorios.
- [ ] La selección fija proveedor, checkpoint, hash, configuración y referencias aprobadas para una nueva versión del motor.
- [ ] Si ningún candidato supera la referencia, MediaPipe permanece activo y la promoción queda explícitamente rechazada.
