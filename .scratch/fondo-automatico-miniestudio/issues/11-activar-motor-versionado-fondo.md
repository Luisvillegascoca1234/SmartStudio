# 11 — Activar el motor versionado de fondo automático

**What to build:** activar para trabajos nuevos la versión de fondo automático que superó calidad y rendimiento, manteniendo resultados históricos, ausencia de controles por fotografía y paridad entre revisión y entrega.

**Blocked by:** 09 — Calibrar visualmente y seleccionar el proveedor; 10 — Optimizar y validar el P95 en la laptop objetivo.

**Status:** ready-for-agent

- [ ] Los trabajos nuevos usan automáticamente la versión aprobada del motor y los resultados históricos conservan su proveedor y comportamiento originales.
- [ ] El operador no ve selección de proveedor, fondo, máscara, intensidad, borde, color o sombra.
- [ ] El estado visible distingue `replaced`, `completed`, `unchanged` y `omitted` con una explicación breve cuando corresponde.
- [ ] La comparación antes/después permite revisar el fondo y la aprobación o rechazo editorial conserva el flujo existente.
- [ ] La vista previa y el JPEG completo aprobado proceden del mismo máster de 16 bits con la misma decisión de fondo.
- [ ] El original, la placa y los modelos permanecen inmutables y fuera de Git.
- [ ] Un recorrido E2E verifica placa válida, fotografía principal, reemplazo, revisión, aprobación, entrega, reinicio y procedencia.
- [ ] Recorridos adicionales verifican fallback de completado, omisión segura y ausencia total de controles por fotografía.
- [ ] La activación conserva funcionamiento local sin internet, GPU prioritaria, CPU de respaldo y cola recuperable.
