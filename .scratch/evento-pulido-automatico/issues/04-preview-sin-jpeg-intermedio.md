# 04 — Eliminar JPEG intermedios y derivar la preview del máster

**What to build:** producir la vista previa de Evento pulido desde el máster de 16 bits sin crear archivos JPEG de trabajo ni sustituir el revelado fotográfico por transformaciones globales posteriores.

**Blocked by:** 03 — Generar una receta XMP y un máster de 16 bits.

**Status:** completed

- [x] Exposición, balance de blancos, distribución tonal, contraste, color, ruido, nitidez y óptica quedan representados en la receta fotográfica del motor principal.
- [x] El pipeline no crea JPEG intermedios para aplicar estilo, correcciones globales o preparar el retoque.
- [x] La preview sRGB se genera directamente desde un máster válido y registra su identificador y hash de origen.
- [x] La preview permite revisar la fotografía mediante comparación, ampliación y desplazamiento.
- [x] Los archivos temporales sin pérdida se eliminan o conservan según su estado sin confundirse con versiones publicadas.
- [x] Un recorrido E2E inspecciona los derivados y demuestra que no existen JPEG intermedios ni transformaciones globales duplicadas.
- [x] Los originales conservan sus hashes y un fallo durante la preview deja el trabajo reintentable.
