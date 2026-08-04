# Referencia de edición en la computadora de desarrollo

Medición automatizada del 4 de agosto de 2026. No sustituye la validación posterior en la laptop objetivo ni el QA visual con fotografías reales.

- Windows 10 Pro, Intel Core i7-10700K, 15.9 GiB de RAM y NVIDIA GeForce RTX 3060 de 12 GiB.
- Recorrido RAW real medido con un Sony ILCE-6000 ARW de 24.4 MiB, conservado fuera de Git: 17,972 ms hasta la vista previa.
- Desglose actual por CPU: revelado, orientación, PNG intermedio y lente 5,436 ms; perfil Natural 1,730 ms; análisis/retoque facial 10,607 ms; vista previa sRGB de 960 px 198 ms.
- La vista previa real quedó por debajo del umbral operativo de 30 segundos en esta computadora; la medición sigue siendo informativa y no sustituye el percentil 95 en la computadora objetivo.
- La instalación OpenCV disponible no incluye CUDA (`0` dispositivos CUDA). La aplicación conserva la ruta CPU y lo advierte; en estas transformaciones cortas no se añadió una transferencia GPU que no aportaría una mejora demostrada.
- El recorrido E2E completo cubre captura, selección, cola, comparación, ajuste, versiones, aprobación, JPEG sRGB completo y respaldo. También simula una vista previa superior a 30 segundos sin bloquear nuevas sesiones.

Las métricas persistidas por trabajo registran solamente duración, ruta CPU/GPU, fallos y reintentos; no almacenan píxeles, nombres de personas ni información privada.
