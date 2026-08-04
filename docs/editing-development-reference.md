# Referencia de edición en la computadora de desarrollo

Medición automatizada del 4 de agosto de 2026. No sustituye la validación posterior en la laptop objetivo ni el QA visual con fotografías reales.

- Windows 10 Pro, Intel Core i7-10700K, 15.9 GiB de RAM y NVIDIA GeForce RTX 3060 de 12 GiB.
- Recorrido RAW real medido con un Sony ILCE-6000 ARW de 24.4 MiB, conservado fuera de Git: 17,972 ms hasta la vista previa.
- Desglose actual por CPU: revelado, orientación, PNG intermedio y lente 5,436 ms; perfil Natural 1,730 ms; análisis/retoque facial 10,607 ms; vista previa sRGB de 960 px 198 ms.
- La vista previa real quedó por debajo del umbral operativo de 30 segundos en esta computadora; la medición sigue siendo informativa y no sustituye el percentil 95 en la computadora objetivo.
- La instalación OpenCV disponible no incluye CUDA (`0` dispositivos CUDA). La aplicación conserva la ruta CPU y lo advierte; en estas transformaciones cortas no se añadió una transferencia GPU que no aportaría una mejora demostrada.
- El recorrido E2E completo cubre captura, selección, cola, comparación, ajuste, versiones, aprobación, JPEG sRGB completo y respaldo. También simula una vista previa superior a 30 segundos sin bloquear nuevas sesiones.

## Referencia darktable + MediaPipe

- darktable 5.6 reveló el Canon CR2 real de 26.2 MiB a un TIFF sRGB de 16 bits y 4010 × 6016 px en aproximadamente 5.1 segundos.
- La corrección Lensfun sobre el TIFF, el perfil Natural, la segmentación MediaPipe, el retoque conservador, el completado uniforme del fondo y el JPEG completo añadieron aproximadamente 15 segundos en la misma computadora.
- El recorrido técnico quedó alrededor de 20 segundos y el análisis de selección devolvió puntuación 100 sin las advertencias falsas anteriores de ojos cerrados, desenfoque o encuadre.
- `darktable-cltest` confirmó OpenCL activo en la NVIDIA GeForce RTX 3060; MediaPipe usa XNNPACK por CPU en esta integración.
- Estas cifras son una referencia manual sobre una sola captura y no sustituyen el percentil 95 ni la validación en la laptop objetivo.

Las métricas persistidas por trabajo registran solamente duración, ruta CPU/GPU, fallos y reintentos; no almacenan píxeles, nombres de personas ni información privada.
