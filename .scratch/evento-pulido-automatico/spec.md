# Especificación: Evento pulido automático

**Status:** ready-for-agent

## Problem Statement

El operador necesita que la fotografía principal de cada sesión fotográfica salga corregida y visiblemente pulida sin detener el flujo del evento ni dedicar tiempo a editar exposición, color o rostros. La primera edición automática existente produce un resultado conservador, aplica parte de la corrección después del revelado RAW mediante transformaciones rasterizadas, usa JPEG intermedios y permite ajustes manuales. Ese comportamiento no garantiza por sí solo un aspecto claramente trabajado, una receta fotográfica reproducible ni que la vista previa aprobada y el JPEG completo procedan del mismo máster.

Durante una boda o evento, el operador no debe convertirse en retocador. Necesita recibir automáticamente un resultado consistente que mejore piel, ojos, dientes, iluminación facial, exposición, color, ruido, detalle y, cuando sea seguro, el fondo uniforme del miniestudio. Como no habrá ajustes manuales para corregir errores caso por caso, el motor también necesita límites obligatorios que impidan modificar identidad, geometría, tono natural de piel, rasgos permanentes o regiones detectadas con poca confianza.

## Solution

Sustituir para los trabajos nuevos el perfil **Natural de evento** por un único perfil versionado llamado **Evento pulido**. La fotografía principal se procesa automáticamente desde RAW mediante una receta explícita de darktable, produce un máster sRGB de 16 bits sin compresión JPEG intermedia y aplica sobre ese máster un retoque visible y controlado basado en regiones detectadas localmente. La vista previa y el JPEG completo se derivan del mismo máster retocado.

El perfil corrige automáticamente exposición, balance de blancos, contraste, color, ruido, detalle y óptica; uniforma visiblemente la piel; reduce brillo, rojeces, ojeras e imperfecciones temporales; corrige ojos rojos; mejora ojos y dientes; equilibra la iluminación facial; y conserva el completado determinista del fondo uniforme cuando existe confianza suficiente. El operador no selecciona perfiles ni modifica parámetros. Solo revisa el antes y después, aprueba el resultado, lo rechaza para conservar el original, revoca una aprobación o reintenta un error técnico.

Cada versión conserva la receta y procedencia necesarias para explicar y repetir el resultado. Una operación localizada incierta se omite de forma independiente, genera una advertencia y no impide aplicar las demás correcciones seguras. Los originales permanecen inmutables y todo el procesamiento funciona localmente.

## User Stories

1. Como operador, quiero que la fotografía principal reciba automáticamente el perfil Evento pulido, para obtener un resultado trabajado sin iniciar un editor.
2. Como operador, quiero que Evento pulido sea el único perfil disponible, para mantener un aspecto consistente entre sesiones fotográficas.
3. Como operador, quiero que la edición comience al finalizar la sesión fotográfica, para no añadir una acción manual al flujo.
4. Como operador, quiero que las fotografías alternativas solo se procesen cuando yo lo solicite, para no consumir recursos innecesariamente.
5. Como operador, quiero que el procesamiento use el RAW cuando esté disponible, para partir de la mayor información fotográfica posible.
6. Como operador, quiero que procesar desde JPEG continúe requiriendo autorización explícita, para conocer esa degradación del flujo normal.
7. Como operador, quiero que un resultado desde JPEG quede claramente identificado, para no confundirlo con un revelado RAW.
8. Como operador, quiero que rawpy quede identificado cuando sustituya a darktable, para conocer el motor que produjo la fotografía.
9. Como operador, quiero que el RAW y el JPEG originales permanezcan inmutables, para conservar siempre la captura original.
10. Como responsable del producto, quiero que cada versión registre el hash de su original, para detectar alteraciones antes de procesar o entregar.
11. Como responsable del producto, quiero que cada versión registre su receta exacta, para poder explicar cómo se produjo.
12. Como responsable del producto, quiero que cada receta tenga versión y hash, para que una modificación futura no altere silenciosamente resultados anteriores.
13. Como responsable del producto, quiero conocer la versión del revelador utilizada, para poder reproducir y diagnosticar una versión.
14. Como operador, quiero que la corrección fotográfica se realice dentro del flujo RAW de darktable, para obtener mejor control tonal y de color.
15. Como operador, quiero una exposición automática equilibrada, para que los rostros y la ropa resulten legibles.
16. Como operador, quiero recuperación moderada de luces, para conservar detalle en vestidos, camisas y piel iluminada.
17. Como operador, quiero recuperación moderada de sombras, para conservar detalle en trajes, cabello y fondos oscuros.
18. Como operador, quiero un balance de blancos natural, para que los tonos de piel no adopten dominantes incorrectas.
19. Como operador, quiero color consistente entre fotografías de una sesión fotográfica, para evitar entregas visualmente dispares.
20. Como operador, quiero contraste visible sin apariencia HDR, para obtener una fotografía pulida pero creíble.
21. Como operador, quiero reducción de ruido dependiente de la captura, para mejorar ISO alto sin borrar el detalle importante.
22. Como operador, quiero nitidez limpia y controlada, para mejorar ojos, cabello y ropa sin crear halos.
23. Como operador, quiero corrección óptica cuando exista información de cámara y lente, para reducir defectos conocidos.
24. Como operador, quiero que la falta de un perfil óptico no bloquee la edición, para continuar con las demás correcciones.
25. Como operador, quiero que la orientación del RAW se respete automáticamente, para revisar la fotografía correctamente.
26. Como operador, quiero que la piel resulte visiblemente más uniforme, para que la corrección se aprecie en el antes y después.
27. Como operador, quiero que el retoque conserve textura suficiente, para evitar una apariencia plástica.
28. Como operador, quiero que el motor reduzca brillos intensos de la piel, para mejorar rostros iluminados por flashes o luces cercanas.
29. Como operador, quiero que el motor reduzca rojeces localizadas, para uniformar el tono sin cambiar el tono natural de piel.
30. Como operador, quiero que el motor atenúe ojeras, para mejorar el rostro sin borrar su estructura natural.
31. Como operador, quiero que el motor atenúe imperfecciones temporales detectadas con confianza, para producir un resultado más pulido.
32. Como responsable del evento, quiero que lunares, cicatrices, tatuajes y otros rasgos permanentes no se eliminen automáticamente, para proteger la identidad de la persona.
33. Como responsable del evento, quiero que el tono natural de piel no cambie significativamente, para mantener fidelidad entre personas y grupos.
34. Como operador, quiero que la barba, las cejas, el cabello y los poros no desaparezcan, para conservar detalle reconocible.
35. Como operador, quiero que el retoque se aplique de forma equilibrada a todos los rostros confiables de un grupo, para evitar que una persona parezca más tratada que otra.
36. Como operador, quiero corrección automática de ojos rojos, para evitar un defecto evidente en la entrega.
37. Como operador, quiero un aclarado controlado de la parte blanca de los ojos, para conseguir una mirada más limpia sin blanco artificial.
38. Como operador, quiero mayor brillo y contraste local en los ojos, para que el retoque se aprecie a tamaño normal.
39. Como operador, quiero mayor definición de pestañas y contorno de ojos, para mejorar la mirada sin modificar su geometría.
40. Como responsable del evento, quiero que el motor no cambie el tamaño ni la forma de los ojos, para conservar identidad.
41. Como responsable del evento, quiero que el motor no cambie el color del iris, para conservar la apariencia real.
42. Como responsable del evento, quiero que el motor no cambie la dirección de la mirada, para no inventar una expresión.
43. Como operador, quiero que los dientes visibles pierdan una dominante amarilla excesiva, para conseguir una mejora claramente apreciable.
44. Como operador, quiero que los dientes aumenten moderadamente su luminosidad, para obtener una sonrisa pulida.
45. Como operador, quiero que labios y encías queden protegidos durante el blanqueamiento, para evitar cambios de color incorrectos.
46. Como operador, quiero que dientes no visibles o detectados con poca confianza no se retoquen, para evitar manchas o regiones inventadas.
47. Como operador, quiero que las sombras faciales demasiado profundas se atenúen, para equilibrar rostros iluminados de forma desigual.
48. Como operador, quiero que los brillos especulares intensos se controlen, para mantener detalle en frente, nariz y mejillas.
49. Como operador, quiero que el rostro reciba un realce local moderado, para separarlo del fondo sin alterar la iluminación global.
50. Como responsable del evento, quiero que el motor no cambie nariz, mandíbula, labios, facciones, rostro o cuerpo, para impedir modificaciones de identidad o geometría.
51. Como responsable del evento, quiero que el motor no rejuvenezca ni envejezca artificialmente a las personas, para mantener fidelidad fotográfica.
52. Como responsable del evento, quiero que el motor no aplique maquillaje generativo, para evitar inventar rasgos visuales.
53. Como responsable del evento, quiero que el motor no invente piel, ojos, dientes o cabello, para conservar exclusivamente información derivada de la captura.
54. Como operador, quiero que cada región detectada tenga una medida de confianza, para que el motor pueda omitir operaciones inseguras.
55. Como operador, quiero que una región incierta se omita sin fallar toda la fotografía, para conservar las demás mejoras seguras.
56. Como operador, quiero recibir una advertencia por cada operación omitida, para saber qué parte no pudo tratarse.
57. Como operador, quiero que una fotografía sin rostros continúe con la corrección fotográfica global, para no tratarla como un error técnico.
58. Como operador, quiero que un rostro parcialmente oculto reciba únicamente operaciones seguras, para evitar artefactos alrededor de gafas, cabello o manos.
59. Como operador, quiero que el completado del fondo uniforme continúe funcionando cuando exista confianza suficiente, para corregir bordes, pared o soportes visibles.
60. Como operador, quiero que cabello, piel, ropa y silueta queden protegidos durante el completado del fondo, para evitar recortes visibles.
61. Como responsable del evento, quiero que un fondo complejo o no uniforme no se reemplace automáticamente, para evitar convertir la función en eliminación general de objetos.
62. Como responsable del evento, quiero que el motor no use relleno generativo, para mantener el procesamiento determinista y local.
63. Como operador, quiero que no existan controles de exposición, temperatura, color o suavizado, para no tener que editar durante el evento.
64. Como operador, quiero que no exista selección de perfiles o intensidades, para que todas las sesiones utilicen Evento pulido.
65. Como operador, quiero comparar el original y Evento pulido inmediatamente, para decidir si el resultado es aceptable.
66. Como operador, quiero ampliar y desplazar la comparación, para revisar piel, ojos, dientes, cabello y bordes.
67. Como operador, quiero aprobar el resultado automático, para convertirlo en la edición vigente de la fotografía.
68. Como operador, quiero rechazar el resultado y conservar el original, para impedir la entrega de una corrección que no acepto.
69. Como operador, quiero que un rechazo editorial sea distinto de un fallo técnico, para comprender por qué la fotografía no está lista para entrega.
70. Como operador, quiero revocar una aprobación, para retirar una decisión anterior sin borrar el resultado ni el original.
71. Como operador, quiero reintentar un error técnico con la misma receta fijada, para recuperarme sin introducir una apariencia distinta.
72. Como operador, quiero que un reintento exitoso no cree versiones ambiguas, para conservar una historia comprensible.
73. Como operador, quiero que la vista previa se derive del máster retocado, para evaluar el resultado que realmente podrá entregarse.
74. Como operador, quiero que el JPEG completo se derive del mismo máster retocado aprobado, para que coincida con la vista previa.
75. Como responsable del producto, quiero que la vista previa registre el hash del máster que la originó, para demostrar su asociación.
76. Como responsable del producto, quiero que la entrega registre el hash del mismo máster, para demostrar la paridad con la revisión.
77. Como operador, quiero que el máster permanezca sin compresión JPEG, para evitar pérdida acumulada antes de la entrega.
78. Como operador, quiero que la vista previa se comprima una sola vez, para conservar calidad y reducir procesamiento innecesario.
79. Como operador, quiero que la entrega se comprima una sola vez, para conservar detalle y gradientes.
80. Como responsable del evento, quiero que la entrega omita GPS y número de serie de la cámara, para proteger metadatos innecesarios.
81. Como operador, quiero que un archivo parcial nunca aparezca como versión válida, para no aprobar un resultado incompleto.
82. Como operador, quiero que el motor valide formato, dimensiones y legibilidad de cada salida, para detectar errores antes de la revisión.
83. Como operador, quiero que un proceso externo bloqueado termine mediante timeout, para que una fotografía no congele toda la cola.
84. Como operador, quiero cancelar un trabajo activo sin dejar procesos huérfanos, para recuperar la operación local.
85. Como operador, quiero que un fallo de darktable permita evaluar la ruta rawpy, para conservar una alternativa local.
86. Como operador, quiero que un fallo localizado de retoque deje un resultado diagnosticable y reintentable, para no confundirlo con una aprobación.
87. Como operador, quiero seguir creando sesiones fotográficas mientras Evento pulido procesa una fotografía anterior, para no detener la captura.
88. Como operador, quiero que la cola continúe procesando una fotografía a la vez inicialmente, para limitar el uso de recursos durante el evento.
89. Como operador, quiero recuperar trabajos interrumpidos después de reiniciar, para continuar desde un estado seguro.
90. Como responsable del producto, quiero métricas separadas de revelado, análisis, retoque, fondo y exportación, para localizar cuellos de botella.
91. Como responsable del producto, quiero distinguir OpenCL disponible de GPU efectivamente utilizada, para evitar métricas engañosas.
92. Como responsable del producto, quiero medir el percentil 95 del tiempo hasta la vista previa, para validar el objetivo operativo.
93. Como operador, quiero que al menos el 95 % de las vistas previas estén disponibles en 30 segundos o menos en la computadora objetivo, para mantener fluido el evento.
94. Como responsable del producto, quiero validar Evento pulido con RAW reales autorizados de la Sony A7 IV, para comprobar el resultado en la cámara objetivo.
95. Como responsable del producto, quiero validar distintos tonos de piel, ropa, gafas, barba y grupos, para reducir artefactos o tratamientos desiguales.
96. Como responsable del producto, quiero comparar las fotografías con referencias aprobadas, para calibrar una corrección visible pero creíble.
97. Como responsable del evento, quiero que fotografías, RAW, modelos, másteres y resultados permanezcan fuera de Git, para proteger privacidad y tamaño del repositorio.
98. Como responsable del evento, quiero que todo el motor funcione sin internet durante el evento, para evitar dependencias externas.
99. Como responsable del evento, quiero que el análisis facial no identifique personas, para evitar una base de datos biométrica.
100. Como desarrollador, quiero conservar legibles las versiones históricas de Natural de evento, para no corromper datos creados antes de Evento pulido.

## Implementation Decisions

- **Evento pulido automático** es una iniciativa incremental del módulo Edición automática. Sustituye el perfil y la experiencia de edición para trabajos nuevos; no elimina ni reescribe resultados históricos.
- Evento pulido es el único perfil disponible para nuevos trabajos. No existen variantes Natural, Intenso ni niveles seleccionables.
- El operador no modifica exposición, temperatura, intensidad de color, suavizado de piel ni otros parámetros. Las acciones editoriales disponibles son revisar, aprobar, rechazar, revocar y volver al original; reintentar se reserva para errores técnicos y utiliza la misma receta fijada.
- La fotografía principal crea automáticamente el trabajo. Las fotografías alternativas mantienen el comportamiento existente y requieren una solicitud explícita.
- El RAW continúa siendo el origen normal. El JPEG requiere autorización explícita y rawpy continúa como respaldo local de darktable; ambos orígenes quedan identificados en la versión.
- darktable es el motor fotográfico principal y recibe una receta explícita, versionada y asociada con la fotografía. La receta se representa inicialmente mediante XMP dentro de un entorno de configuración aislado y no depende de la biblioteca personal del operador.
- La receta de Evento pulido contempla preparación RAW, orientación, corrección óptica, reconstrucción de luces, balance de blancos, calibración de color, exposición, distribución tonal, contraste, color, reducción de ruido y nitidez. La elección final entre módulos fotográficos equivalentes queda fijada por versión después de comparar el conjunto de referencia; una versión nunca cambia retroactivamente.
- Los ajustes automáticos dependientes de la captura forman parte de la receta efectiva y se registran. No se exponen como controles del operador.
- darktable produce un máster revelado TIFF sRGB de 16 bits. Las transformaciones fotográficas globales actuales posteriores al revelado dejan de ser la fuente del perfil.
- El análisis facial y de personas utiliza una copia sRGB de análisis y modelos locales. Las máscaras y landmarks obtenidos se trasladan a la resolución del máster; la copia de análisis no es un resultado entregable.
- MediaPipe permanece como base ya aceptada para landmarks y segmentación. Incorporar otro modelo local de segmentación facial solo se considera si las pruebas de aceptación demuestran que las regiones necesarias no pueden separarse con suficiente confianza; esa selección requerirá revisar la decisión arquitectónica correspondiente.
- El retoque visible contempla piel, brillo, rojeces, ojeras, imperfecciones temporales, ojos rojos, luminosidad y detalle de ojos, dientes e iluminación facial. Cada operación tiene límites fijos y una condición de confianza independiente.
- Los límites obligatorios no son configurables por el operador. Prohíben cambios de identidad, facciones, geometría, cuerpo, forma o tamaño de ojos, color del iris, dirección de la mirada, tono natural de piel y rasgos permanentes; también prohíben edición generativa e inventar regiones ausentes.
- Una operación localizada que no alcanza su umbral se omite de manera independiente, registra una advertencia y permite que continúen las operaciones seguras. La ausencia de rostro no impide la corrección fotográfica global.
- El completado determinista del fondo uniforme se conserva. Solo usa regiones limpias de la misma fotografía, protege personas y se omite ante un fondo o una máscara inciertos.
- El pipeline no usa JPEG intermedios. Después del revelado se conserva un máster de 16 bits; después del retoque se publica un máster retocado de 16 bits del que se derivan la vista previa y la entrega.
- La vista previa y el JPEG completo registran el identificador y hash del mismo máster retocado. La aprobación no vuelve a interpretar el RAW con el entorno actual cuando el máster validado sigue disponible.
- La vista previa es sRGB y permite revisar detalle mediante ampliación y desplazamiento. El JPEG completo es sRGB, de resolución completa y omite metadatos sensibles.
- Una versión registra como mínimo: origen y hash del original, identificador y versión del perfil, receta efectiva y su hash, revelador y versión, perfil ICC, versiones o huellas de modelos y algoritmos, operaciones aplicadas u omitidas, advertencias, hash del máster y asociación de sus salidas.
- El rechazo editorial queda representado separadamente de fallos técnicos, cancelaciones y rechazo del fallback JPEG. Un resultado rechazado no queda listo para entrega y el original continúa disponible.
- Los datos históricos de Natural de evento y sus ajustes permanecen legibles e inmutables. La migración añade los campos necesarios sin reinterpretar versiones anteriores como Evento pulido.
- Los procesos externos admiten timeout, cancelación y terminación del árbol de procesos en Windows. Un proceso bloqueado no puede impedir indefinidamente que avance la cola.
- Los resultados parciales se escriben temporalmente y solo se publican después de validar formato, dimensiones, legibilidad y asociación. Un archivo parcial nunca constituye una versión válida.
- Las métricas distinguen revelado, análisis, retoque, fondo y exportación. OpenCL disponible no se presenta como prueba de que todas las etapas usaron GPU.
- La operación normal permanece local, sin internet y con una ruta funcional por CPU. Fotografías, RAW, modelos, másteres, cachés y resultados permanecen fuera de Git.
- No se añade una pantalla de QA dentro de la aplicación.

## Testing Decisions

- La costura automatizada principal es un recorrido E2E de la aplicación completa, desde una fotografía principal hasta Evento pulido listo para revisión, aprobación y generación del JPEG completo. Se reutiliza el precedente existente de Playwright, servidor local real, estado persistente y directorio temporal aislado.
- Las pruebas observan comportamiento externo: estados visibles, acciones permitidas, archivos publicados, hashes, advertencias, recuperación y relación entre original, máster, vista previa y entrega. No afirman clases internas, llamadas privadas ni detalles de implementación de los filtros.
- El recorrido principal comprueba que Evento pulido es el único perfil visible y que no existen controles de exposición, temperatura, color, piel, niveles o selección de perfil.
- Desde la misma costura se comprueba que el operador puede comparar, ampliar, aprobar, rechazar, revocar, volver al original y reintentar errores técnicos, y que no puede alterar parámetros.
- El recorrido verifica que el original conserva su hash y que cada versión registra receta, procedencia y máster.
- La paridad se verifica demostrando que vista previa y entrega están asociadas con el mismo máster retocado. La comparación de archivos JPEG considera sus diferencias de resolución y compresión y no exige hashes idénticos entre salidas.
- El directorio derivado se inspecciona desde el recorrido para demostrar que no existen JPEG intermedios y que los archivos parciales no se publican como versiones.
- Se cubren darktable normal, rawpy de respaldo, autorización JPEG, RAW ausente, incompatible o corrupto, timeout, cancelación, fallo localizado, reintento y recuperación después de reiniciar.
- Se cubren fotografías sin rostro, una persona, grupos, rostro parcialmente oculto, gafas, barba, dientes no visibles, ojos inciertos y fondo no uniforme. Cada caso afirma operaciones aplicadas u omitidas y advertencias observables.
- Los límites obligatorios se verifican con fixtures controlados que permiten comparar geometría, regiones protegidas, tono de piel, iris, cabello, ropa y silueta antes y después. La prueba evita depender de nombres de modelos o filtros específicos.
- El completado de fondo reutiliza el precedente existente: modifica únicamente regiones externas a la persona cuando el fondo es uniforme y se omite ante fondo o máscara inciertos.
- La calidad fotográfica se valida sobre el mismo recorrido con RAW reales autorizados y referencias aprobadas almacenadas fuera de Git. Esta validación es externa a la aplicación y no crea una segunda API ni un modo interno de QA.
- La evaluación visual cubre exposición, luces, sombras, balance de blancos, color, ruido, nitidez, textura de piel, brillo, rojeces, ojeras, ojos, dientes, cabello, gafas, ropa clara y oscura y bordes de persona.
- La corrección debe apreciarse a tamaño normal, conservar textura suficiente al 100 %, evitar piel plástica, halos, banding y apariencia HDR y mantener un tratamiento equilibrado entre integrantes de un grupo.
- Las fotografías privadas, RAW reales, modelos y resultados de QA permanecen fuera de Git. Los fixtures versionados son sintéticos, controlados o cuentan con autorización adecuada.
- El rendimiento se mide por etapa y como tiempo total hasta la vista previa. El objetivo final continúa siendo que al menos el 95 % de las vistas previas estén disponibles en 30 segundos o menos en la computadora objetivo.
- Las mediciones en la computadora de desarrollo secundaria son informativas y no sustituyen la validación en la laptop objetivo.
- No se adopta TDD como metodología global. Cada incremento se verifica después de implementarse mediante la combinación proporcional de E2E, integración local con darktable, imágenes de referencia, inspección visual autorizada y mediciones.

## Out of Scope

- Perfiles Natural, Intenso u otras variantes seleccionables.
- Ajustes del operador de exposición, temperatura, intensidad de color, piel, ojos, dientes, iluminación facial o fondo.
- Curvas, capas, máscaras manuales, pinceles o un editor fotográfico avanzado.
- Reprocesamiento editorial con parámetros diferentes; solo se reintentan errores técnicos con la receta fijada.
- Modificación de facciones, rostro, cuerpo, nariz, mandíbula, labios o geometría.
- Cambio de tamaño o forma de ojos, color del iris o dirección de la mirada.
- Cambio significativo del tono natural de piel.
- Eliminación automática de lunares, cicatrices, tatuajes u otros rasgos permanentes.
- Rejuvenecimiento, envejecimiento, maquillaje generativo o modificación de identidad.
- Invención generativa de piel, ojos, dientes, cabello, personas, objetos o escenas.
- Reencuadre o recorte automático.
- Reemplazo arbitrario del fondo o eliminación general de objetos. Solo permanece el completado determinista del fondo uniforme ya aceptado.
- Reconocimiento o identificación de personas.
- Procesamiento automático de todas las fotografías alternativas.
- Cambios en la recepción Sony, asociación de archivos o cierre de series.
- Rediseño del respaldo incremental o administración definitiva de retención y cachés.
- QR, descarga a invitados, impresión, mensajes desde iPad y libro digital.
- Servicios obligatorios en la nube, APIs pagadas o descargas durante el evento.
- Una pantalla o modo de QA dentro de la aplicación.

## Further Notes

- Esta especificación sustituye, para trabajos nuevos, los requisitos de **Natural de evento**, niveles de suavizado y ajustes manuales de la especificación histórica de Edición automática. La especificación anterior permanece como registro de la funcionalidad ya implementada.
- El contexto de dominio se actualiza junto con esta especificación para registrar Evento pulido, los límites obligatorios y el máster retocado como términos confirmados.
- La decisión arquitectónica existente sobre darktable y MediaPipe describe el flujo predeterminado de darktable y transformaciones conservadoras con OpenCV. Evento pulido cambia la receta, intensidad y pipeline; antes de implementar debe actualizarse o sustituirse ese ADR con las decisiones concretas de XMP, procesamiento de 16 bits y aplicación del retoque.
- La decisión sobre completado determinista del fondo sigue vigente en comportamiento, aunque su referencia al perfil Natural de evento deberá cambiarse por Evento pulido cuando se reconcilien los ADR.
- El primer perfil que se calibra es Sony A7 IV con iluminación controlada. Condiciones menos controladas y cada modelo Canon mantienen validaciones físicas separadas aunque compartan el nombre de producto Evento pulido.
- El resultado visible se calibra con material real autorizado antes de optimizar rendimiento. No se aceptan mejoras de velocidad que degraden la referencia visual aprobada.
- La aprobación humana permanece como decisión final aunque el procesamiento no ofrezca ajustes manuales.
