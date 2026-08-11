# 03 — Generar una receta XMP y un máster de 16 bits

**What to build:** procesar la fotografía principal RAW con una receta Evento pulido explícita y versionada mediante darktable, produciendo un máster TIFF sRGB de 16 bits con procedencia suficiente para repetir y diagnosticar el resultado.

**Blocked by:** 01 — Activar Evento pulido para trabajos nuevos; 02 — Supervisar los procesos locales del motor.

**Status:** completed

- [x] Cada trabajo RAW nuevo recibe una receta efectiva explícita asociada con su versión de Evento pulido.
- [x] La receta incluye versión y hash y no depende de la biblioteca ni de los presets personales del operador.
- [x] darktable recibe el RAW y la receta y genera un TIFF sRGB de tres canales y 16 bits.
- [x] El motor valida formato, profundidad, dimensiones y legibilidad antes de publicar el máster.
- [x] La versión registra hash del original, receta y hash, revelador y versión, perfil ICC y hash del máster.
- [x] El máster se escribe temporalmente y solo se publica después de superar todas las validaciones.
- [x] Un fallo de receta, revelador o archivo de salida no publica un máster parcial ni modifica el RAW.
- [x] Una verificación de integración local cubre la invocación real de darktable con material autorizado fuera de Git, además de los recorridos controlados reproducibles.
