# ADR 0001 — LibRaw/rawpy para el revelado RAW local

**Estado:** reemplazada por ADR 0002 como ruta principal; conservada como respaldo

## Decisión

La primera ruta de revelado RAW usa LibRaw 0.22 mediante rawpy 0.27 y un proceso Python local. La app convierte el RAW a píxeles sRGB temporales y continúa la edición con Sharp. La ruta funciona por CPU, sin internet y sin modificar el original.

## Motivo

LibRaw 0.22 declara soporte para Sony ZV-E10 II y para numerosas cámaras Canon que producen CR2; rawpy distribuye binarios de Windows. En esta computadora se verificó el revelado real de un Sony ARW de referencia. darktable 5.6 sigue siendo una alternativa investigada, pero su instalador de Windows requiere una decisión interactiva de alcance y no es una dependencia automática del proyecto.

## Consecuencias

- El entorno necesita Python 3.11+ y `pip install -r requirements-raw.txt`.
- Una cámara o variante no compatible se presenta como una condición recuperable con autorización JPEG explícita.
- La prueba física con un ARW producido por la ZV-E10 II del usuario queda separada del QA automatizado.
- La aceptación de `.CR2` reutiliza la misma ruta LibRaw; la compatibilidad del modelo Canon concreto debe comprobarse con un archivo real.
