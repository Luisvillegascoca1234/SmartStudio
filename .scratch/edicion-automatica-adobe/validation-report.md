# Informe de validación de la prueba de concepto Adobe

**Fecha:** 2026-08-09
**Estado:** implementación funcional; QA de interfaz parcial; validación operativa pendiente
**Decisión actual:** no habilitar todavía como ruta operativa de eventos.

## Computadora de desarrollo

- Windows 11 Home.
- AMD Ryzen 5 240 con Radeon 760M integrada.
- 15.3 GB de RAM.
- Photoshop estable 27.8; Camera Raw 18.4.1.
- darktable 5.6.0, Python 3.11.9 y Node 24.18.0.

## Evidencia aprobada

- La suite completa aprobó 46/46 escenarios E2E en 5.1 minutos con un solo worker.
- El lote autorizado de validación de fondo aprobó 3/3 casos; el revelado adaptativo, el retoque facial conservador y la limpieza de fondos neutros quedaron cubiertos por pruebas sintéticas y revisión visual real.
- Los escenarios cubren preparación Adobe, Natural, Fondo explícito, recursos y ajustes versionados, fallos/timeout/salida tardía, reintento/reinicio, corrección manual PSD, continuidad de captura, respaldo/SSD y recuperación explícita mediante el motor local.
- La integración real procesó el Sony ILCE-6000 `DSC01542.ARW` mediante Camera Raw, Action y Droplet de Photoshop en 8,227 ms.
- El RAW conservó antes y después el SHA-256 `ce8b4957281a817d52a07a691e2468567b6c78223bd0b514ffc1c65b002b8d89`.
- El resultado real fue JPEG sRGB de 6000 × 4000, legible, sin EXIF ni XMP; SHA-256 `4bad95eb796d9bb5024bf44ec567a22a75f91ea590c31b861bb38656b728cf4d`.
- RSS del coordinador Node: 109,461,504 bytes antes y 78,319,616 bytes después. Esto no equivale al pico conjunto de Photoshop y Camera Raw.
- Lightroom, Firefly y funciones generativas no participan en el contrato ni en el manifiesto de recursos.
- Fotografías, resultados, PSD, modelos, Actions instaladas, Droplets y el reporte detallado permanecen bajo `.smartstudio-data`, fuera de Git.

## QA de interfaz solicitado

El 2026-08-09 se recorrió la aplicación como operador desde el navegador integrado, contra el servidor local con el motor Adobe real:

- Se creó un evento, una sesión y una serie; se importó el par real `DSC01542.ARW` + `DSC01542.jpg`, se seleccionó la captura como principal y se finalizó la sesión.
- La edición Natural terminó lista para revisar en 17.52 s, sin demoras, fallos ni timeouts. La interfaz identificó el motor Adobe y las versiones 1.0.0 del preset y la Action.
- La comparación alternó correctamente entre vista dividida, original y edición. La salida aprobada es JPEG sRGB de 6000 × 4000, sin EXIF ni XMP y con 9,653,929 bytes.
- Los hashes de las copias originales coincidieron con los registrados: RAW `ce8b4957281a817d52a07a691e2468567b6c78223bd0b514ffc1c65b002b8d89` y JPEG `58a0856cda085a9703797ce1589cfd5dc4393158ce1e8609477efca6b61ba9ad`.
- La corrección manual preparó una ruta PSD reversible, conservó la versión automática y se pudo cancelar desde la interfaz.
- SmartStudio-Fondo se solicitó expresamente. Al usar un paisaje sin personas, omitió el cambio de fondo con avisos de baja confianza y ausencia de rostros; se rechazó esa versión y se aprobó la versión Natural.
- El recorrido se inspeccionó a 1440 × 900 y 390 × 844 sin desbordamiento horizontal del documento ni bloqueo del flujo.
- La ruta de SSD inexistente se rechazó sin persistir la configuración y sin errores en la consola del navegador.

### Hallazgo de QA

- **UX moderada:** al configurar una ruta de SSD inexistente, el aviso muestra directamente `ENOENT: no such file or directory, stat ...`. La acción falla de forma segura, pero el mensaje técnico no orienta al operador. Debe sustituirse por una explicación accionable antes del endurecimiento operativo.

## Comparación disponible

| Criterio | Adobe | Motor local |
|---|---|---|
| Origen registrado | Sí | Sí |
| RAW normal / JPEG autorizado | Sí | Sí |
| Vista previa derivada del JPEG completo | Sí | Sí |
| Recuperación ante ausencia de Adobe | Ofrece cambio explícito | Sigue disponible |
| Fallos, reinicio, respaldo y versiones | Cubiertos | Cubiertos por regresión |
| Calidad visual equivalente | Pendiente de material autorizado | Pendiente de la misma comparación |
| Percentil 95 ≤ 30 s | Una muestra real: 8.23 s | No medido con el mismo lote |

No se elige una ruta ganadora: todavía falta comparar calidad y rendimiento sobre exactamente el mismo lote autorizado.

## Validaciones pendientes

- Ejecutar sin conectividad de red real y comprobar licencia ya iniciada, Camera Raw, Photoshop, preset, Actions, Droplets y modelos locales. La inspección de código confirma que SmartStudio no hace solicitudes de red, pero no sustituye la prueba desconectada.
- Procesar al menos 20 fotografías autorizadas para que una sola demora por encima de 30 s ya incumpla el objetivo mínimo del 95 %.
- Incluir una persona, grupos, tonos de piel diversos, ropa clara/oscura, cabello suelto, aretes, gafas y fondo uniforme interrumpido.
- Revisar visualmente Natural, Fondo y una corrección manual a ampliación suficiente sobre el lote autorizado. El QA solicitado validó la interfaz y un paisaje público, pero no permite aprobar piel, cabello, accesorios, grupos ni bordes de personas.
- Medir pico de memoria del conjunto SmartStudio + Photoshop + Camera Raw y duración de intervención manual.
- Comparar Adobe y darktable con el mismo material y una pauta de calidad acordada.

## Criterio para avanzar

La alternativa puede avanzar a uso operativo sólo si completa las validaciones anteriores, mantiene al menos 19 de 20 vistas previas en 30 segundos o menos, no presenta pérdida de originales/asociaciones y el operador acepta la calidad de Natural, Fondo y bordes. Hasta entonces es una prueba de concepto funcional y recuperable, no una ruta operativa aprobada.
