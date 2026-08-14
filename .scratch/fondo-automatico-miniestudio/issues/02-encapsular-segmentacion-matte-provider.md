# 02 — Encapsular la segmentación mediante MatteProvider

**What to build:** hacer que el completado de fondo existente obtenga su separación de persona y fondo mediante un contrato común de matte, conservando el comportamiento visible actual y registrando la procedencia de la segmentación.

**Blocked by:** None — can start immediately.

**Status:** completed

- [x] El proveedor actual entrega alpha, persona segura, fondo seguro, borde incierto, confianza, versión y ruta de ejecución mediante un único contrato.
- [x] El completado ya implementado consume ese contrato sin depender directamente de una biblioteca o formato de modelo concreto.
- [x] Los resultados existentes `completed`, `unchanged` y `omitted` continúan observándose de la misma manera durante la transición.
- [x] Cada trabajo registra proveedor, modelo, huella, confianza y ruta CPU/GPU sin exponer selección al operador.
- [x] Un proveedor no disponible produce una omisión o fallback diagnosticable y nunca publica un archivo parcial.
- [x] Las capturas controladas de prueba dejan de depender de cadenas mágicas para representar los casos del matte.
- [x] Un recorrido completo demuestra que el fondo actual sigue siendo procesable después del prefactor.
