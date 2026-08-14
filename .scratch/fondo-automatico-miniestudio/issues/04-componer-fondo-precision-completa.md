# 04 — Componer el fondo con precisión completa

**What to build:** aplicar el completado sobre la región realmente confirmada del fondo mediante composición flotante y salida efectiva de 16 bits, conservando las regiones limpias y evitando halos o banding.

**Blocked by:** 03 — Proteger bordes mediante matte suave y trimap.

**Status:** completed

- [x] La detección de una interrupción produce una máscara de región objetivo y no autoriza sustituir todo el fondo limpio.
- [x] Persona segura y borde incierto permanecen fuera de la región reemplazada.
- [x] La estimación y composición se realizan con precisión flotante sobre el máster y publican una salida efectiva de 16 bits.
- [x] Un gradiente de fondo de 16 bits conserva más precisión que incrementos equivalentes a 8 bits.
- [x] El alpha suave evita una unión dura alrededor de cabello, ropa y accesorios.
- [x] La operación no cambia dimensiones, orientación, encuadre ni geometría.
- [x] Vista previa y entrega continúan derivándose del mismo máster que contiene la decisión de fondo.
- [x] Pruebas controladas demuestran modificación exclusiva de la región objetivo, conservación de personas y ausencia de archivos intermedios válidos.
