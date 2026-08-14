# 03 — Proteger bordes mediante matte suave y trimap

**What to build:** mejorar la separación actual para que las decisiones de fondo utilicen probabilidades y una banda localizada de incertidumbre, protegiendo detalles finos en lugar de depender de una máscara binaria de baja resolución.

**Blocked by:** 02 — Encapsular la segmentación mediante MatteProvider.

**Status:** completed

- [x] El matte distingue persona segura, fondo seguro y borde incierto mediante un alpha suave.
- [x] La confianza se evalúa específicamente alrededor del contorno y no solo mediante un promedio global.
- [x] Cabello, manos, espacios entre brazos, velos, encaje, transparencias, flores y accesorios reciben protección adaptativa.
- [x] El matte calculado sobre una imagen reducida se refina contra la fotografía de resolución completa antes de componer.
- [x] Una región relevante de borde incierto impide el reemplazo completo y conserva el fondo original.
- [x] La omisión explica que el límite obligatorio falló en el contorno sin mostrar parámetros editables.
- [x] Fixtures controlados cubren bordes finos, regiones semitransparentes, una persona, parejas y grupos.
- [x] Las pruebas comparan el comportamiento observable del alpha y de regiones protegidas, no funciones internas del proveedor.
