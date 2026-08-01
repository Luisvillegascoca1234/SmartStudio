# Especificación: Evento, captura y selección

**Status:** ready-for-agent

## Problem Statement

Durante una boda o evento, el operador necesita recibir con rapidez las fotografías tomadas en un miniestudio, mantenerlas separadas por grupo de invitados y elegir las mejores sin mezclar archivos ni depender de procesos manuales frágiles. La Sony A7 IV produce RAW + JPEG y debe conservar los originales en su tarjeta, mientras la laptop organiza una copia de trabajo y un respaldo externo.

El operador debe revisar series cortas, apoyarse en advertencias automáticas de calidad, seleccionar hasta tres fotografías y marcar una principal. El proceso debe seguir funcionando ante desconexiones, poco espacio, reinicios o ausencia temporal de la cámara, sin borrar capturas ni elegir fotografías automáticamente.

## Solution

Crear el primer módulo operativo de SmartStudio para abrir un evento, verificar que el entorno mínimo está disponible, recibir capturas RAW + JPEG, agruparlas en sesiones y series, mostrar vistas previas y registrar una selección principal.

La conexión USB con la Sony A7 IV será la fuente principal. Una carpeta de importación ofrecerá respaldo operativo y un modo de simulación reproducible para desarrollo. La aplicación guardará automáticamente el estado, conservará los originales, copiará el evento al SSD externo cuando esté disponible y permitirá recuperar el trabajo después de una interrupción.

El resultado del módulo será una sesión conservada en estado listo para edición, con hasta tres fotografías seleccionadas y exactamente una principal. La edición y las salidas posteriores pertenecen a otras especificaciones.

## User Stories

1. Como operador, quiero crear un evento con un nombre, para agrupar correctamente todas las sesiones de una boda o actividad.
2. Como operador, quiero que la fecha y hora del evento se completen automáticamente, para reducir escritura y errores.
3. Como operador, quiero añadir ubicación y notas opcionales, para disponer de contexto cuando resulte útil sin ralentizar la preparación.
4. Como operador, quiero abrir un evento existente, para reanudar trabajo interrumpido o continuar tareas posteriores.
5. Como operador, quiero que exista un solo evento operativo activo, para evitar que las capturas se asignen al evento equivocado.
6. Como operador, quiero ver una verificación previa de cámara, almacenamiento, SSD y alimentación, para detectar problemas antes de recibir invitados.
7. Como operador, quiero recibir una advertencia cuando el espacio sea bajo, para poder conectar almacenamiento o reducir el riesgo.
8. Como operador, quiero continuar con una advertencia cuando el espacio sea bajo, para no detener innecesariamente el evento.
9. Como operador, quiero terminar la sesión activa cuando el espacio pase a crítico, para no perder un trabajo en curso.
10. Como operador, quiero impedir sesiones nuevas cuando el espacio sea crítico y no exista un SSD verificado, para proteger Windows y los archivos del evento.
11. Como operador, quiero que un fallo del SSD genere una alerta sin detener la captura, para poder continuar usando la tarjeta de la cámara y el disco interno.
12. Como operador, quiero que todas las capturas se copien al SSD externo en segundo plano, para disponer de un respaldo adicional del evento.
13. Como operador, quiero conocer si cada copia al SSD fue verificada, para no asumir que existe un respaldo incompleto.
14. Como fotógrafo, quiero guardar RAW + JPEG en la tarjeta de la cámara, para conservar una copia original aunque falle el cable o la laptop.
15. Como operador, quiero recibir RAW + JPEG desde la Sony A7 IV conectada por USB, para evitar importaciones manuales durante la operación normal.
16. Como operador, quiero ver el JPEG tan pronto como llegue, para revisar la captura sin esperar el procesamiento del RAW.
17. Como operador, quiero conocer si el RAW correspondiente todavía está pendiente, para no confundir una vista previa con un archivo listo para edición.
18. Como operador, quiero importar capturas desde una carpeta, para recuperar archivos desde la tarjeta o desde otra herramienta cuando falle la transferencia USB.
19. Como desarrollador, quiero simular capturas mediante una carpeta, para probar el flujo sin tener la Sony A7 IV conectada permanentemente.
20. Como operador, quiero que la importación USB, manual y simulada produzcan el mismo comportamiento visible, para no aprender flujos distintos.
21. Como operador, quiero iniciar una sesión con un número automático y hora, para identificarla sin introducir datos obligatorios.
22. Como operador, quiero añadir una etiqueta opcional a la sesión, para reconocer un grupo cuando resulte útil.
23. Como operador, quiero mantener solo una sesión activa, para impedir que fotografías de grupos diferentes se mezclen.
24. Como operador, quiero cancelar una sesión sin borrar sus capturas, para manejar abandonos o errores sin pérdida de datos.
25. Como operador, quiero restaurar una sesión cancelada, para corregir una cancelación accidental.
26. Como operador, quiero iniciar manualmente una serie dentro de la sesión, para decidir qué capturas pertenecen a la misma ronda.
27. Como operador, quiero cerrar manualmente una serie y pasar a revisión, para no depender de tiempos de espera adivinados por la aplicación.
28. Como operador, quiero crear varias series en una misma sesión, para repetir poses sin perder las fotografías anteriores.
29. Como operador, quiero excluir capturas accidentales o de prueba de la selección, para mantener clara la revisión sin borrarlas.
30. Como operador, quiero ver miniaturas y una vista ampliada de la serie, para comparar expresiones y enfoque.
31. Como operador, quiero recibir advertencias de desenfoque, movimiento, ojos cerrados, encuadre, exposición o archivo incompleto, para revisar primero las candidatas más prometedoras.
32. Como operador, quiero que la aplicación destaque u ordene candidatas por calidad, para acelerar la revisión.
33. Como operador, quiero conservar la decisión final sobre todas las fotografías, para que una recomendación automática no reemplace el criterio humano.
34. Como operador, quiero que ninguna fotografía se descarte o elimine automáticamente, para evitar pérdidas por una clasificación incorrecta.
35. Como operador, quiero seleccionar como máximo tres fotografías, para mantener el flujo de entrega controlado.
36. Como operador, quiero marcar exactamente una seleccionada como principal, para entregar a los módulos posteriores una decisión inequívoca.
37. Como operador, quiero cambiar la principal antes de cerrar la selección, para corregir preferencias sin perder las alternativas.
38. Como operador, quiero conservar hasta dos fotografías alternativas, para poder procesarlas o entregarlas posteriormente.
39. Como operador, quiero que la aplicación rechace un estado con más de tres seleccionadas o sin principal, para evitar sesiones ambiguas.
40. Como operador, quiero que toda acción se guarde automáticamente, para no depender de un botón manual de guardado.
41. Como operador, quiero recuperar el evento, la sesión, las series y la selección después de reiniciar la aplicación, para continuar desde el último estado confirmado.
42. Como operador, quiero que los RAW y JPEG originales sean inmutables, para conservar siempre la evidencia original de captura.
43. Como operador, quiero recibir alertas visuales y sonoras configurables ante fallos de transferencia, almacenamiento o respaldo, para reaccionar sin vigilar cada proceso.
44. Como operador, quiero usar mouse y atajos de teclado para acciones frecuentes, para revisar series con rapidez.
45. Como operador, quiero una interfaz en español orientada al flujo del evento, para no enfrentar términos técnicos innecesarios.
46. Como operador, quiero un registro técnico local de transferencias, tiempos, fallos y reintentos, para diagnosticar problemas sin exponer fotografías ni mensajes.
47. Como responsable del evento, quiero que las métricas permanezcan locales, para proteger la privacidad de los invitados.
48. Como responsable del producto, quiero verificar al menos 150 sesiones y 1.500 capturas RAW + JPEG por evento, para tener margen suficiente para una boda típica.
49. Como operador, quiero que el módulo produzca una sesión claramente lista para edición, para continuar posteriormente sin reinterpretar la selección.
50. Como operador, quiero que el módulo no inicie edición, QR, impresión o libro digital, para mantener claro el límite de esta primera entrega.

## Implementation Decisions

- El alcance se limita a una sola aplicación local y al módulo **Evento, captura y selección**.
- Solo puede existir un evento operativo activo y una sesión activa dentro de ese evento.
- Un evento requiere nombre y fecha/hora automática; ubicación y notas son opcionales.
- Una sesión recibe número consecutivo, hora y etiqueta opcional.
- Una sesión contiene una o más series; el operador inicia y cierra cada serie manualmente.
- El modo principal de captura es Sony A7 IV por USB, configurada para RAW + JPEG y RAW con compresión sin pérdidas L.
- La cámara conserva sus archivos en la tarjeta; la transferencia a la laptop no sustituye esa copia.
- La importación desde carpeta sirve como respaldo y como simulador de desarrollo.
- JPEG se usa para vista previa inmediata y se asocia con su RAW correspondiente para trabajo posterior.
- Si falta el RAW, el módulo conserva el estado que permitirá al operador autorizar más adelante un procesamiento de emergencia desde JPEG.
- El análisis de calidad señala posibles problemas y puede ordenar candidatas, pero nunca selecciona, descarta ni elimina automáticamente.
- Una sesión permite hasta tres selecciones y exige exactamente una principal antes de quedar lista para edición.
- Las capturas excluidas, sesiones canceladas y series anteriores se conservan y pueden recuperarse.
- Los originales son inmutables; el estado operativo y las selecciones se guardan automáticamente.
- El SSD externo recibe una copia en segundo plano de todas las capturas y datos del evento, con verificación del resultado.
- Un fallo del SSD alerta sin bloquear; el espacio interno bajo permite continuar con advertencia.
- Con espacio crítico y sin SSD se permite terminar la sesión activa, pero se bloquea el inicio de una nueva.
- La verificación previa incluye al menos cámara, tarjeta/copia de origen, almacenamiento interno, SSD y alimentación eléctrica.
- La operación normal será en español, con mouse y atajos de teclado y notificaciones sonoras configurables.
- Los registros y métricas son locales y no incluyen imágenes, contenido privado ni secretos.
- El módulo debe soportar como objetivo 150 sesiones y 1.500 pares RAW + JPEG por evento.
- No se seleccionan todavía tecnologías, bibliotecas, modelo de datos ni arquitectura interna concreta; esas decisiones requieren investigación y tickets posteriores.

## Testing Decisions

- Las verificaciones se escribirán y ejecutarán después de cada incremento; esta especificación no exige TDD.
- El principal punto de verificación automatizada será el flujo completo visible desde la interfaz usando la fuente simulada por carpeta.
- Un buen escenario verifica comportamiento observable: estados mostrados, archivos recibidos, selecciones aceptadas o rechazadas, persistencia, recuperación y respaldo; no inspecciona detalles internos.
- El escenario principal recorrerá creación de evento, verificación previa, sesión, recepción RAW + JPEG, varias series, advertencias de calidad, selección, principal, reinicio y recuperación.
- Se probarán ambos órdenes de llegada del par: JPEG antes que RAW y RAW antes que JPEG.
- Se probarán almacenamiento suficiente, bajo y crítico; SSD disponible, desconectado y con copia fallida.
- Se verificará que cancelaciones y exclusiones no borren originales y que puedan restaurarse cuando corresponda.
- Se verificará que no puedan seleccionarse más de tres fotografías ni finalizar una selección sin exactamente una principal.
- Se realizará una prueba de capacidad con el equivalente a 150 sesiones y 1.500 pares de archivos, midiendo estabilidad, almacenamiento y tiempos de respuesta.
- La integración USB tendrá una validación adicional con la Sony A7 IV y la laptop objetivo. El simulador no sustituye esa prueba física.
- Las imágenes de prueba automatizada serán fixtures controlados sin fotografías privadas de eventos reales.
- No existe código previo ni pruebas equivalentes en el repositorio; este flujo será el primer precedente de verificación funcional.

## Out of Scope

- Revelado RAW y edición automática.
- Calibración técnica, estilo visual y suavizado de piel.
- Aprobación de la fotografía editada.
- Generación de QR, servidor web local y descargas.
- Red Wi-Fi para invitados.
- Impresión y selección de impresora.
- Mensajes manuscritos o mecanografiados desde iPad.
- Generación y revisión del libro digital PDF.
- Entregas digitales o impresas.
- Procesamiento de fotografías tomadas fuera del miniestudio controlado.
- Cuentas, autenticación interna o múltiples operadores simultáneos.
- Selección automática de la fotografía principal.
- Eliminación automática de capturas.
- Elección definitiva de tecnologías, frameworks o arquitectura interna.

## Further Notes

- El objetivo global confirmado es completar desde **“Revisar serie”** hasta QR listo en menos de dos minutos; este módulo debe aportar mediciones de sus propias etapas, pero el objetivo completo se validará cuando exista el módulo de entrega.
- La computadora objetivo es una laptop Windows 11 con Ryzen 5 240, 16 GB de RAM y RTX 5050 Laptop de 8 GB. La computadora secundaria tiene RTX 3060 de 12 GB y no representa por sí sola el rendimiento final.
- La laptop dispone de almacenamiento interno limitado; para eventos grandes se recomienda un SSD externo de al menos 1 TB y una comprobación obligatoria de capacidad.
- La conexión USB real, el emparejamiento RAW + JPEG y la disponibilidad de mecanismos de transferencia de Sony requieren investigación y prototipos antes de comprometer una implementación definitiva.
- La impresora permanece pendiente porque todavía no se ha elegido hardware.
