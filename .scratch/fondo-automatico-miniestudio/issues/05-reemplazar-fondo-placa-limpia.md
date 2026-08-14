# 05 — Reemplazar automáticamente mediante la placa limpia

**What to build:** usar la placa limpia válida del evento y el matte seguro para reemplazar automáticamente el fondo de una fotografía principal, conservando las rutas de completado y omisión cuando el reemplazo no sea posible.

**Blocked by:** 01 — Registrar y validar la placa limpia del evento; 04 — Componer el fondo con precisión completa.

**Status:** completed

- [x] Una fotografía principal con placa y matte confiables termina con decisión `replaced` sin una acción adicional del operador.
- [x] La placa se adapta de forma determinista a geometría compatible, color e iluminación de la captura.
- [x] La adaptación y composición no modifican personas, ropa, cabello, accesorios ni otras regiones protegidas.
- [x] Las sombras compatibles pueden conservarse cuando su separación sea confiable; una sombra incierta no habilita una sustitución insegura.
- [x] Sin placa válida se intenta el completado existente y el resultado puede ser `completed`, `unchanged` u `omitted`.
- [x] Una placa incompatible o un matte incierto conservan el fondo original y generan una razón observable.
- [x] No aparecen controles de placa, máscara, intensidad, color, borde, sombra o proveedor por fotografía.
- [x] La versión registra decisión, motivo, hash de placa, confianza y asociación con el mismo máster de vista previa y entrega.
- [x] Un recorrido E2E cubre las cuatro decisiones `replaced`, `completed`, `unchanged` y `omitted`.
