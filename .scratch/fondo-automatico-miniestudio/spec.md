# Especificación: Fondo automático del miniestudio

**Status:** ready-for-agent

## Problem Statement

El operador necesita que las fotografías del miniestudio presenten un fondo limpio y consistente sin detener el evento para crear máscaras, elegir fondos o corregir bordes manualmente. El motor actual solo intenta completar interrupciones de un fondo uniforme usando regiones limpias de la misma fotografía. Esa ruta se omite correctamente cuando el fondo no es suficientemente uniforme, cuando queda poca superficie limpia o cuando la máscara de la persona es incierta; por ello, fotografías válidas del miniestudio pueden conservar pared, soportes, límites del fondo o variaciones que el operador esperaba corregir automáticamente.

La implementación actual tampoco constituye todavía una solución óptima para bordes fotográficos reales. La segmentación de baja resolución se convierte en una máscara dura, la confianza se evalúa de forma global, la composición se calcula con precisión efectiva de 8 bits y las pruebas controladas no demuestran calidad sobre cabello, velos, encaje, transparencias, manos, flores o grupos. Como no existirán ajustes por fotografía, el motor debe mejorar esos bordes sin ampliar silenciosamente el alcance a reemplazo arbitrario, eliminación general de objetos o edición generativa.

## Solution

Añadir a Evento pulido una capacidad automática y local de **fondo automático del miniestudio**. Durante la preparación del evento, el operador captura una **placa limpia** del fondo instalado sin personas. La aplicación valida y asocia esa referencia con el evento. Para cada fotografía principal que llega a edición, el motor obtiene un **matte de persona** suave, evalúa de forma localizada la confianza del contorno y decide sin intervención por fotografía entre tres rutas: reemplazar el fondo mediante la placa limpia, completar el fondo uniforme desde regiones seguras de la propia fotografía o conservar el fondo original.

El reemplazo utiliza únicamente la placa limpia del mismo evento, adapta su color e iluminación de forma determinista y compone en precisión flotante sobre el máster retocado de 16 bits. Cabello, piel, ropa, velos, transparencias, manos, flores, accesorios y siluetas quedan protegidos mediante un alpha suave y una banda explícita de incertidumbre. Una región incierta provoca omisión segura; no se expone al operador ningún control de máscara, intensidad, color o fondo.

La segmentación queda detrás de un proveedor sustituible para comparar el MediaPipe existente con un modelo de matte especializado ejecutado mediante ONNX Runtime. La aplicación prioriza CUDA en la GPU NVIDIA y conserva CPU como respaldo, reutilizando una sesión caliente para mantener el objetivo global de vista previa. Cada resultado registra su decisión, confianza, placa, proveedor, versión, ruta de procesamiento y tiempos.

## User Stories

1. Como operador, quiero capturar una placa limpia al preparar el miniestudio, para que la aplicación conozca el fondo real del evento.
2. Como operador, quiero que la placa se configure una sola vez por evento, para no repetir ajustes en cada sesión fotográfica.
3. Como operador, quiero que la aplicación confirme si la placa es válida, para no descubrir un problema después de fotografiar invitados.
4. Como operador, quiero que una placa con personas sea rechazada, para evitar incorporarlas accidentalmente a otros resultados.
5. Como operador, quiero que una placa ilegible o incompleta sea rechazada, para impedir composiciones inválidas.
6. Como operador, quiero que la placa quede asociada únicamente con su evento, para evitar mezclar fondos de montajes diferentes.
7. Como responsable del evento, quiero que la placa original permanezca inmutable, para conservar una referencia verificable.
8. Como responsable del producto, quiero que la placa tenga un hash registrado, para detectar sustituciones o alteraciones.
9. Como operador, quiero que el fondo se procese automáticamente junto con Evento pulido, para no iniciar una acción adicional por fotografía.
10. Como operador, quiero que la fotografía principal use automáticamente la placa válida del evento, para mantener consistencia entre sesiones fotográficas.
11. Como operador, quiero que las fotografías alternativas usen la misma decisión de fondo cuando se procesen, para mantener el aspecto del evento.
12. Como operador, quiero que el motor detecte a todas las personas de una pareja o grupo, para protegerlas durante la composición.
13. Como invitado, quiero que mi cabello quede conservado, para evitar recortes o halos visibles.
14. Como invitado, quiero que velos, encaje y telas semitransparentes se conserven de forma natural, para mantener el detalle de mi vestimenta.
15. Como invitado, quiero que manos, dedos y espacios entre brazos se separen correctamente del fondo, para evitar deformaciones visuales.
16. Como invitado, quiero que flores, gafas y accesorios asociados con mi silueta queden protegidos, para conservar la fotografía real.
17. Como responsable del evento, quiero que el motor use un alpha suave, para evitar un contorno recortado artificialmente.
18. Como responsable del evento, quiero que el motor distinga persona segura, borde incierto y fondo seguro, para tomar decisiones localizadas.
19. Como responsable del evento, quiero que la confianza se evalúe especialmente alrededor del contorno, para no aceptar una máscara solo porque su promedio global parece seguro.
20. Como operador, quiero que una parte incierta de la silueta impida un reemplazo inseguro, para conservar la fotografía sin artefactos.
21. Como operador, quiero que una máscara incierta produzca una explicación comprensible, para saber por qué se conservó el fondo original.
22. Como operador, quiero que una placa confiable y una máscara confiable produzcan el reemplazo automáticamente, para obtener un fondo consistente sin editar.
23. Como operador, quiero que el color de la placa se adapte a la captura de forma determinista, para evitar una unión visual evidente.
24. Como operador, quiero que la luminosidad del fondo se adapte sin cambiar a las personas, para mantener naturalidad.
25. Como operador, quiero que las sombras compatibles puedan conservarse cuando mejoren el anclaje visual, para evitar que las personas parezcan flotantes.
26. Como responsable del evento, quiero que el reemplazo modifique únicamente el fondo, para proteger identidad, cuerpo, ropa y accesorios.
27. Como responsable del evento, quiero que la operación no recorte ni reencuadre la fotografía, para conservar la composición original.
28. Como responsable del evento, quiero que la operación no cambie la geometría de personas u objetos protegidos, para conservar fidelidad.
29. Como operador, quiero que el fondo conserve gradientes suaves, para evitar banding en impresiones o ampliaciones.
30. Como operador, quiero que la composición mantenga precisión efectiva de 16 bits hasta el máster, para no degradar el pipeline sin pérdidas.
31. Como operador, quiero que la vista previa represente el mismo fondo del máster, para evaluar el resultado que podría entregarse.
32. Como operador, quiero que el JPEG completo aprobado proceda del mismo máster, para que coincida con la revisión.
33. Como operador, quiero que la ausencia de una placa válida no convierta el trabajo en un fallo, para seguir procesando el resto de Evento pulido.
34. Como operador, quiero que sin placa válida se intente el completado seguro ya existente, para conservar una mejora posible.
35. Como operador, quiero que el fondo original se conserve cuando tampoco sea seguro completarlo, para evitar resultados defectuosos.
36. Como operador, quiero distinguir si el fondo fue reemplazado, completado, no necesitó cambios u omitido, para comprender el resultado.
37. Como operador, quiero conocer el motivo de una omisión sin ver parámetros técnicos editables, para mantener una operación sencilla.
38. Como operador, quiero que no existan controles de máscara por fotografía, para no convertirme en retocador durante el evento.
39. Como operador, quiero que no exista selección de fondos por fotografía, para mantener una apariencia consistente.
40. Como operador, quiero que no existan controles de intensidad, borde, color o desenfoque del fondo, para conservar la automatización completa.
41. Como responsable del evento, quiero que el sistema no incorpore escenas ajenas al evento, para mantener un resultado determinista.
42. Como responsable del evento, quiero que el sistema no use relleno generativo, para evitar contenido inventado.
43. Como responsable del evento, quiero que la función no elimine objetos en general, para mantener el alcance limitado al fondo del miniestudio.
44. Como responsable del producto, quiero comparar proveedores de matte mediante un contrato común, para mejorar el modelo sin reescribir el compositor.
45. Como responsable del producto, quiero que cada resultado registre el proveedor y versión del matte, para reproducir y diagnosticar la salida.
46. Como responsable del producto, quiero registrar la confianza y región incierta del matte, para explicar decisiones automáticas.
47. Como responsable del producto, quiero registrar el hash de la placa utilizada, para asociar el resultado con su referencia exacta.
48. Como responsable del producto, quiero registrar si la inferencia usó GPU o CPU, para interpretar tiempos y fallos.
49. Como operador, quiero que el motor use la GPU NVIDIA cuando esté disponible, para reducir el tiempo hasta la vista previa.
50. Como operador, quiero que el motor continúe por CPU cuando CUDA no esté disponible, para no bloquear el evento.
51. Como operador, quiero que el modelo permanezca cargado entre fotografías, para evitar pagar repetidamente su tiempo de inicio.
52. Como operador, quiero que un fallo del proveedor especializado permita recurrir al proveedor seguro disponible, para mantener continuidad operativa.
53. Como operador, quiero que un fallo de todos los proveedores conserve el fondo original y deje el trabajo diagnosticable, para no publicar un archivo parcial.
54. Como responsable del producto, quiero medir por separado segmentación, refinamiento y composición, para encontrar cuellos de botella.
55. Como operador, quiero que el fondo automático preserve el objetivo global de vista previa P95 de 30 segundos, para mantener fluido el evento.
56. Como responsable del producto, quiero validar el fondo con fotografías autorizadas de la Sony A7 IV, para comprobar la cámara y el entorno objetivo.
57. Como responsable del producto, quiero validar cabello claro sobre fondo claro y cabello oscuro sobre fondo oscuro, para medir los casos difíciles de separación.
58. Como responsable del producto, quiero validar parejas y grupos, para evitar que una persona quede parcialmente reemplazada.
59. Como responsable del producto, quiero validar ropa blanca y negra, para detectar pérdida de bordes por similitud con el fondo.
60. Como responsable del producto, quiero validar velos, encaje, transparencias, flores y accesorios, para evaluar detalles finos reales.
61. Como responsable del producto, quiero medir halos, banding y cambios dentro de la persona, para decidir si un proveedor puede activarse.
62. Como responsable del producto, quiero conservar fotografías, placas, modelos y resultados fuera de Git, para proteger privacidad y tamaño del repositorio.
63. Como responsable del evento, quiero que la operación normal funcione sin internet, para no depender de servicios externos.
64. Como operador, quiero seguir aprobando o rechazando el resultado completo de Evento pulido, para conservar la decisión editorial final.

## Implementation Decisions

- Fondo automático del miniestudio es una capacidad de Evento pulido y no un editor independiente. Solo modifica la etapa de fondo; no redefine revelado, color, piel, ojos, dientes ni iluminación facial.
- La placa limpia es una fotografía del fondo instalado sin personas, capturada durante la preparación y asociada con un único evento. No es una plantilla global, una escena arbitraria ni contenido generado.
- La aplicación valida que la placa sea legible, tenga dimensiones y orientación utilizables y no contenga personas detectadas. La validación visual definitiva de compatibilidad con el montaje forma parte del flujo de preparación.
- La placa original es inmutable y permanece fuera de Git. El evento conserva su identificador, hash, dimensiones, fecha de captura y estado de validación.
- El operador no configura parámetros por fotografía. La única preparación adicional es registrar o renovar la placa limpia cuando cambia físicamente el montaje del fondo.
- La decisión automática tiene cuatro resultados observables: `replaced`, `completed`, `unchanged` y `omitted`.
- `replaced` requiere una placa válida y un matte que cumpla los límites obligatorios de confianza.
- `completed` conserva el comportamiento determinista de ADR 0003 cuando no existe una placa válida y el fondo uniforme puede reconstruirse desde la misma fotografía.
- `unchanged` indica que no se detectó una corrección necesaria. `omitted` indica que una ruta potencial no alcanzó la confianza requerida y conserva el fondo original.
- La segmentación se encapsula detrás de un `MatteProvider`. El resultado común contiene alpha suave, persona segura, fondo seguro, borde incierto, confianza, proveedor, versión, huella del modelo y ruta de ejecución.
- MediaPipe permanece como referencia y respaldo inicial. Se prototipan proveedores especializados de matte, comenzando por variantes ligeras o de retrato de BiRefNet ejecutadas con ONNX Runtime. Ningún modelo se promueve sin validar checkpoint, licencia, procedencia, hash, calidad y rendimiento.
- El proveedor ONNX prioriza CUDA en la GPU NVIDIA y conserva CPU como respaldo. La selección efectiva se registra en cada trabajo.
- Los modelos se cargan una vez en un trabajador local persistente y reciben warm-up durante la preparación. Un cierre o bloqueo del trabajador es supervisado y no deja resultados parciales válidos.
- La imagen reducida puede usarse para inferencia o análisis, pero el matte se refina contra la fotografía de resolución completa antes de componer.
- La confianza se calcula por píxel y se evalúa específicamente en una banda alrededor del contorno. La confianza global por sí sola no autoriza el reemplazo.
- El refinamiento produce un trimap con persona segura, fondo seguro y región incierta. Cabello, velos, encaje, transparencias, manos, flores y accesorios reciben protección de borde adaptativa.
- La operación no sustituye automáticamente una región marcada como incierta. Si no puede producirse un matte seguro para toda la silueta relevante, se omite el reemplazo completo.
- El compositor trabaja en precisión flotante y publica un máster efectivo de 16 bits. No convierte la composición del fondo a una paleta efectiva de 8 bits.
- La placa se adapta mediante transformaciones deterministas de geometría compatible, color e iluminación. La adaptación no modifica los píxeles protegidos de las personas.
- La máscara de reemplazo se limita al fondo seguro. La composición conserva alpha suave y puede preservar sombras compatibles cuando su separación sea confiable.
- No se cambia tamaño, forma, posición o geometría de personas; tampoco se recorta o reencuadra la fotografía.
- La vista previa y el JPEG completo se derivan del mismo máster retocado que contiene la decisión de fondo.
- Cada versión registra decisión de fondo, motivo, hash de placa, proveedor y versión del matte, huella del modelo, medidas de confianza, ruta GPU/CPU, tiempos y advertencias.
- La ruta normal es completamente local. Placas, modelos, mattes temporales, fotografías, másteres y resultados permanecen fuera de Git.
- La capacidad no añade una pantalla interna de QA ni controles de edición. La revisión existente de antes/después y la aprobación editorial permanecen sin cambios de alcance.
- La activación del proveedor especializado queda protegida por versión o feature flag técnica hasta superar la comparación A/B. Ese mecanismo no se expone como control operativo.

## Testing Decisions

- La costura automatizada principal es un recorrido E2E de la aplicación completa: un evento con placa limpia validada recibe una fotografía principal, ejecuta Evento pulido y publica una vista previa cuyo estado informa la decisión automática del fondo.
- Ese recorrido verifica únicamente comportamiento observable: asociación de la placa, estado de fondo, advertencias, procedencia, archivos publicados, integridad del original y relación entre máster, vista previa y entrega.
- El recorrido principal confirma que no aparecen controles de máscara, proveedor, intensidad, color, borde o selección de fondo por fotografía.
- La misma costura cubre las cuatro decisiones: reemplazo con placa y matte confiables, completado sin placa, ausencia de cambio necesario y omisión por incertidumbre.
- La vista previa y la entrega aprobada deben estar asociadas con el mismo máster. No se acepta recomponer el fondo de forma independiente al entregar.
- Las pruebas de integración visual del compositor constituyen una costura de apoyo. Comparan regiones protegidas, alpha, gradientes y bordes mediante imágenes controladas sin afirmar funciones internas específicas.
- Los fixtures sintéticos cubren una persona, pareja, grupo, espacios entre brazos, cabello fino, velo, encaje, transparencias, manos, flores, accesorios, sombras y fondos con gradientes.
- Una prueba de precisión demuestra que un gradiente de 16 bits no queda reducido a incrementos propios de 8 bits después de la composición.
- Las pruebas verifican que los píxeles de persona segura no cambian y que la región incierta no se sustituye de forma dura.
- Se cubren placa ausente, placa corrupta, placa con persona, placa de otro evento, dimensiones incompatibles, matte incierto, proveedor no disponible y fallo del trabajador.
- Se cubren CUDA disponible, fallback CPU y consistencia visual aceptable entre rutas. No se exige tiempo idéntico ni salida binaria idéntica cuando el proveedor lo impida.
- La recuperación verifica que un cierre durante segmentación o composición no publique un máster parcial y que el trabajo pueda continuar o reintentarse de forma técnica.
- La comparación de proveedores se realiza con un banco externo autorizado y versionado por manifiesto, sin incorporar fotografías ni resultados a Git.
- El banco real incluye cabello claro y oscuro, velos, encaje, transparencias, parejas, grupos, ropa blanca y negra, manos, flores, soportes, pared, sombras y fondos uniformes o deliberadamente incompatibles.
- La evaluación real mide calidad en la banda de contorno, píxeles protegidos modificados, halos, contaminación de color, banding, reemplazos falsos y omisiones falsas. Los umbrales de promoción se fijan durante la calibración con referencias aprobadas, no se inventan en pruebas unitarias.
- La aceptación visual inspecciona las fotografías al 100 % y a tamaño normal. Las métricas automatizadas ayudan a detectar regresiones, pero no sustituyen la aprobación visual del conjunto autorizado.
- El rendimiento registra carga o warm-up, inferencia, refinamiento, composición y tiempo total hasta la vista previa. La aceptación final mantiene el objetivo global de P95 menor o igual a 30 segundos en la computadora objetivo.
- La computadora de desarrollo sirve para comparación inicial; no sustituye la medición con la RTX 5050 y la ruta CPU de la laptop objetivo.
- La implementación se verifica incrementalmente después de cada cambio. No se adopta TDD como metodología global.

## Out of Scope

- Revelado RAW, exposición, balance de blancos, contraste, color, ruido o nitidez.
- Retoque de piel, ojos, dientes o iluminación facial.
- Elegir un fondo distinto para cada fotografía.
- Galerías de fondos, fondos temáticos, escenas externas o plantillas arbitrarias.
- Fondos generados mediante IA o relleno generativo.
- Eliminación general de objetos, personas o elementos fuera de la capacidad específica del fondo.
- Máscaras, pinceles, capas o refinamiento manual por fotografía.
- Controles del operador para intensidad, alpha, borde, color, desenfoque, sombra o proveedor.
- Cambio de identidad, cuerpo, facciones, ropa, cabello, accesorios o geometría.
- Reencuadre, recorte, enderezado o cambio de perspectiva de la fotografía.
- Sustituir fondos complejos tomados fuera del miniestudio.
- Procesamiento obligatorio en la nube, APIs pagadas o descargas durante el evento.
- Una pantalla de QA dentro de la aplicación.
- QR, impresión, entrega a invitados, mensajes desde iPad o libro digital.

## Further Notes

- Esta iniciativa sustituye la restricción de usar exclusivamente regiones limpias de la misma fotografía cuando existe una placa limpia válida. ADR 0003 permanece como fallback de completado y ADR 0005 registra la nueva decisión.
- El término “reemplazo” se limita al fondo real preparado para el mismo evento. No autoriza incorporar una escena elegida libremente.
- La fotografía mostrada durante la evaluación fue omitida porque el fondo no alcanzó la uniformidad exigida por el motor actual. Ese comportamiento es seguro y sirve como caso real de regresión: la nueva ruta solo debe reemplazarlo si la placa y el matte superan sus propios límites obligatorios.
- La evaluación inicial compara MediaPipe refinado y BiRefNet mediante ONNX Runtime. La especificación no predetermina qué checkpoint se activa; la evidencia visual, licencia y P95 deciden la promoción.
- El seam principal fue confirmado por el usuario: fotografía principal, placa limpia del evento, procesamiento completo, estado y vista previa observables, misma procedencia para entrega y ausencia de controles por fotografía.
