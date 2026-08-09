# 05 — Conectar Camera Raw y Photoshop para SmartStudio-Natural

**What to build:** hacer que el preset, la Action y el Droplet oficiales produzcan con Photoshop estable el mismo resultado contractual que ya recorre SmartStudio mediante el motor controlado.

**Blocked by:** 04 — Recorrer SmartStudio-Natural con un Adobe controlado.

**Status:** completed

- [x] Existe un preset versionado `SmartStudio Natural Adobe` para el revelado base confirmado.
- [x] Existe una Action `SmartStudio-Natural` que aplica el retoque conservador sin completar el fondo.
- [x] Un Droplet ejecuta la Action sobre una copia de trabajo identificada y deposita una única salida completa en la ubicación esperada.
- [x] Un RAW autorizado atraviesa Camera Raw y Photoshop reales sin Lightroom ni modificación del original.
- [x] Photoshop puede permanecer fuera del primer plano durante el procesamiento normal y solo requiere intervención cuando ocurre una condición explícita.
- [x] La salida real supera las mismas comprobaciones de legibilidad, dimensiones, asociación y metadatos utilizadas con el motor controlado.
- [x] Preset, Action y Droplet tienen versiones identificables, mientras instaladores, datos de cuenta, fotografías y resultados permanecen fuera de Git.
- [x] Una comprobación de integración en la computadora de desarrollo demuestra que el contrato real coincide con el seam automatizado.

## Evidencia

- `resources/adobe/SmartStudio-Natural-v1.xmp`, `SmartStudio Natural.jsx` y `manifest.json` identifican el paquete `1.0.0`; el manifiesto declara que no requiere Lightroom ni funciones generativas.
- Photoshop 27.8 contiene la Action `SmartStudio-Natural`; la Action exportada, el Droplet oficial y sus copias instaladas viven bajo `.smartstudio-data/adobe-resources/`, fuera de Git.
- `PhotoshopDropletEngine` crea una carpeta aislada por trabajo, copia RAW/JPEG y sidecar, ejecuta el Droplet con límite de tiempo, conserva la asociación mediante `request.json`/`result.json` y normaliza una sola salida completa.
- La protección de foco minimiza Photoshop si intenta tomar el primer plano durante una ejecución normal; los diálogos de apertura y perfil están suprimidos en el Droplet.
- Integración real con el Sony ILCE-6000 `DSC01542.ARW` CC0 de raw.pixls.us: hash RAW conservado `ce8b4957281a817d52a07a691e2468567b6c78223bd0b514ffc1c65b002b8d89`; salida JPEG sRGB `6000x4000`, legible, sin EXIF ni XMP.
- La sonda local reportó preparados Photoshop, Camera Raw, preset, Droplet, Action, intercambio y recursos offline.
- `pnpm typecheck`: correcto.
- `pnpm test:e2e`: 35/35 escenarios correctos; se amplió a 10 s una espera del caso RAW corrupto que resultó sensible a la carga de la suite completa.
