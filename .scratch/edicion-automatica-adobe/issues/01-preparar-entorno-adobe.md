# 01 — Preparar y verificar el entorno Adobe

**What to build:** dejar la computadora de desarrollo preparada y comprobada para implementar la alternativa Adobe sin descubrir dependencias básicas faltantes durante los incrementos posteriores.

**Blocked by:** None — can start immediately.

**Status:** completed

- [x] Photoshop estable y Adobe Camera Raw están instalados, se abren correctamente y muestran versiones registradas para la prueba de concepto.
- [x] Creative Cloud permite activar Photoshop y Camera Raw sin utilizar Photoshop Beta como motor principal.
- [x] Node.js y pnpm coinciden con las versiones requeridas por el proyecto y las dependencias del repositorio están instaladas.
- [x] Python y los requisitos locales existentes están instalados para conservar las capacidades compartidas de SmartStudio.
- [x] Darktable está instalado y disponible como alternativa explícita cuando Adobe no pueda utilizarse.
- [x] La GPU y su controlador se detectan, sin convertir la aceleración en requisito para iniciar el desarrollo.
- [x] La comprobación de tipos y la compilación existentes finalizan correctamente antes de modificar la integración de edición.
- [x] No se incorporan a Git licencias, credenciales, instaladores, modelos, fotografías ni resultados.

## Evidencia de verificación

- Photoshop estable 2026 `27.8`, Adobe Camera Raw `18.4.1` y Creative Cloud `6.9.0.620` instalados; Photoshop estable abrió y respondió correctamente.
- Node.js `24.18.0`, pnpm `9.15.4`, Python `3.11.9`, darktable `5.6.0` y NVIDIA GeForce RTX 5050 Laptop con controlador `596.21` detectados.
- `rawpy 0.27.0`, `mediapipe 0.10.35`, OpenCV `4.13.0` y `lensfunpy 1.18.0` importaron correctamente; los modelos oficiales de landmarks y segmentación se reconstruyeron fuera de Git.
- Las dependencias Node y Chromium de Playwright quedaron instalados.
- `pnpm check` aprobó comprobación de tipos y compilación.
- La suite E2E alcanzó 29 recorridos aprobados al combinar la ejecución integral con la repetición focalizada de dos fallos ambientales. Permanece un fallo independiente: la prueba de importación robusta espera una etiqueta textual anterior aunque la interfaz muestra correctamente los archivos en el campo `Archivos seleccionados`.
