# Especificación: Edición automática

**Status:** ready-for-agent

## Problem Statement

Después de que el operador termina una sesión fotográfica y elige una fotografía principal, todavía necesita revelar y corregir esa imagen antes de aprobarla para entrega. Hacerlo manualmente durante una boda o evento rompe el flujo de SmartStudio, exige cambiar de aplicación y dificulta mantener un aspecto consistente entre grupos de invitados.

El operador necesita obtener rápidamente una edición natural y uniforme, revisar claramente el antes y el después, realizar unos pocos ajustes seguros y conservar la decisión final. El proceso debe funcionar localmente, no debe modificar los originales y no debe impedir que continúen las siguientes sesiones fotográficas mientras se procesa una imagen.

## Solution

Incorporar a SmartStudio el módulo **Edición automática**, conectado con las sesiones fotográficas listas para edición. Al finalizar una sesión, la fotografía principal entra en una cola local y genera una vista previa mediante el perfil **Natural de evento**. El operador compara el resultado con el original, ajusta parámetros acotados, reprocesa cuando sea necesario y aprueba una versión.

El módulo procesa preferentemente el RAW, permite recurrir al JPEG solo con autorización explícita y conserva cada resultado como una versión derivada. Una aprobación genera posteriormente un JPEG sRGB de resolución completa, sin alterar los archivos originales. La cola, las versiones, los parámetros y las aprobaciones se guardan para recuperarse después de un reinicio.

La primera entrega funcional se desarrollará y medirá en la computadora de desarrollo secundaria. La computadora objetivo seguirá siendo el entorno de validación final. Esta iniciativa no cierra ni sustituye las validaciones pendientes de **Evento, captura y selección**.

## User Stories

1. Como operador, quiero que la fotografía principal entre automáticamente en edición al finalizar una sesión fotográfica, para no iniciar manualmente otro flujo.
2. Como operador, quiero que una fotografía alternativa se procese solo cuando yo lo solicite, para no consumir recursos innecesariamente.
3. Como operador, quiero que la edición use el RAW disponible, para obtener el mejor punto de partida posible.
4. Como operador, quiero conocer claramente cuando una fotografía no tiene RAW disponible, para no confundir una edición de emergencia con el flujo normal.
5. Como operador, quiero autorizar explícitamente el procesamiento desde JPEG, para conservar el control sobre esa degradación.
6. Como operador, quiero que todo resultado procesado desde JPEG permanezca identificado, para no tratarlo como equivalente a un revelado RAW.
7. Como operador, quiero que la app admita archivos Sony ARW y Canon CR2 acompañados por JPEG, para trabajar con las cámaras previstas mediante el mismo flujo local.
8. Como operador, quiero que un RAW corrupto o incompatible produzca un error comprensible, para decidir si autorizo el JPEG o corrijo el archivo.
9. Como operador, quiero que los RAW y JPEG originales permanezcan inmutables, para conservar siempre la captura original.
10. Como operador, quiero que cada procesamiento genere una versión derivada independiente, para comparar o recuperar resultados anteriores.
11. Como operador, quiero que cada versión registre su perfil, parámetros, origen y fecha, para comprender cómo fue producida.
12. Como operador, quiero que cada sesión fotográfica muestre el estado de edición de su fotografía principal, para saber qué requiere atención.
13. Como operador, quiero distinguir los estados en cola, procesando, lista para revisar, aprobada, interrumpida, cancelada y fallida, para entender el progreso.
14. Como operador, quiero ver una cola con sesión fotográfica, fotografía, estado y tiempo transcurrido, para supervisar varios trabajos.
15. Como operador, quiero que la cola procese los trabajos en orden de llegada, para obtener un comportamiento predecible.
16. Como operador, quiero que solo se procese una fotografía a la vez inicialmente, para limitar el consumo de recursos durante el evento.
17. Como fotógrafo, quiero seguir creando sesiones fotográficas mientras se edita una imagen anterior, para no detener la captura de invitados.
18. Como operador, quiero cancelar un procesamiento sin afectar el original, para recuperar recursos cuando ya no necesito ese resultado.
19. Como operador, quiero reintentar un trabajo fallido o interrumpido, para recuperarme sin repetir la captura ni la selección.
20. Como operador, quiero que una misma fotografía y versión de perfil no creen trabajos duplicados accidentalmente, para evitar resultados ambiguos.
21. Como operador, quiero que `Reprocesar` cree deliberadamente una versión nueva, para conservar la versión anterior.
22. Como operador, quiero que los trabajos pendientes puedan terminar después de cerrar un evento, para no perder procesamiento ya iniciado.
23. Como operador, quiero que un evento cerrado no admita solicitudes nuevas de edición, para mantener claro su estado operativo.
24. Como operador, quiero seleccionar un perfil de edición para el evento antes de la primera sesión fotográfica, para mantener consistencia entre invitados.
25. Como operador, quiero comenzar con el perfil Natural de evento, para obtener un resultado conservador sin calibración previa.
26. Como operador, quiero que cada trabajo conserve una instantánea de la versión del perfil utilizada, para que cambios futuros no alteren silenciosamente resultados anteriores.
27. Como operador, quiero que cambiar el perfil afecte solo a trabajos futuros, para proteger ediciones aprobadas o ya procesadas.
28. Como operador, quiero poder reprocesar una fotografía anterior con el perfil actualizado, para adoptar conscientemente el nuevo aspecto.
29. Como operador, quiero una corrección natural de exposición, para compensar errores moderados sin producir una apariencia artificial.
30. Como operador, quiero una corrección natural del balance de blancos, para mantener tonos de piel coherentes.
31. Como operador, quiero contraste y color moderados, para evitar un estilo agresivo o una apariencia HDR.
32. Como operador, quiero que se protejan piel y ropa clara al recuperar luces, para no perder detalle importante.
33. Como operador, quiero recuperar sombras moderadamente, para mejorar visibilidad sin introducir un aspecto irreal.
34. Como operador, quiero reducción de ruido y nitidez moderadas, para mejorar detalle sin producir piel plástica ni halos.
35. Como operador, quiero que se respete la orientación registrada en la captura, para revisar la fotografía correctamente.
36. Como operador, quiero corrección de lente basada en metadatos cuando esté disponible, para reducir defectos conocidos sin bloquear imágenes sin perfil.
37. Como operador, quiero suavizado de piel desactivado, suave o medio, para adaptar el resultado sin aplicar un retoque fuerte.
38. Como operador, quiero que el suavizado suave sea el valor predeterminado, para conservar textura natural.
39. Como operador, quiero que el suavizado se aplique uniformemente a los rostros detectados, para mantener coherencia en fotografías grupales.
40. Como operador, quiero una advertencia cuando un rostro no pueda tratarse con confianza, para revisar el resultado sin recurrir a máscaras manuales.
41. Como operador, quiero corrección suave de ojos rojos, para mejorar retratos sin cambiar la apariencia de los ojos.
42. Como operador, quiero mejora ligera de brillo y nitidez de ojos, para dar claridad sin modificar color, tamaño, forma o dirección de la mirada.
43. Como operador, quiero blanqueamiento dental moderado, para reducir dominantes amarillas sin perder textura ni producir blanco puro.
44. Como responsable del evento, quiero que la edición no altere facciones, cuerpo ni identidad, para conservar fidelidad fotográfica.
45. Como operador, quiero que la app no reencuadre automáticamente, para conservar la composición elegida durante la captura.
46. Como operador, quiero que la app no reemplace fondos ni elimine objetos, para mantener claro el alcance de la edición fotográfica.
47. Como responsable del evento, quiero que el módulo no realice reconocimiento de identidad, para evitar una base de datos biométrica.
48. Como operador, quiero comparar antes y después mediante vista dividida y alternancia inmediata, para evaluar claramente la edición.
49. Como operador, quiero ampliar y desplazar la vista, para revisar rostro, textura y detalle.
50. Como operador, quiero ajustar exposición, temperatura, intensidad de color y suavizado de piel, para corregir el resultado sin enfrentar un editor complejo.
51. Como operador, quiero que los ajustes estén acotados, para evitar resultados extremos durante una operación rápida.
52. Como operador, quiero restablecer la edición automática, para descartar ajustes manuales sin perder otras versiones.
53. Como operador, quiero aprobar una versión, para convertirla en el resultado vigente de la fotografía.
54. Como operador, quiero revocar una aprobación, para volver a revisar sin borrar la versión aprobada anteriormente.
55. Como operador, quiero reabrir una edición aprobada, para crear y evaluar otra versión sin perder la vigente.
56. Como operador, quiero que cambiar la fotografía principal invalide el resultado vigente para esa sesión, para evitar entregar la fotografía equivocada.
57. Como operador, quiero conservar las versiones de la principal anterior, para no perder trabajo al corregir la selección.
58. Como operador, quiero que cada fotografía alternativa tenga su propia aprobación, para no confundir sus resultados con la principal.
59. Como operador, quiero recibir primero una vista previa sRGB ligera, para revisar con rapidez.
60. Como operador, quiero que la aprobación genere un JPEG sRGB de resolución completa con los mismos parámetros, para disponer de una salida consistente.
61. Como operador, quiero que una edición se declare lista para entrega solo cuando el JPEG completo sea legible y esté asociado con su original, para no avanzar con un archivo incompleto.
62. Como operador, quiero que una edición lista para entrega registre su aprobación, para que los módulos posteriores reciban una decisión inequívoca.
63. Como responsable del evento, quiero que la copia destinada a entrega no exponga GPS ni número de serie de la cámara, para proteger información innecesaria.
64. Como operador, quiero que los resultados y sus datos se copien al SSD configurado, para conservar un respaldo adicional.
65. Como operador, quiero que un fallo del SSD genere una alerta sin detener automáticamente la edición, para continuar usando el almacenamiento interno.
66. Como operador, quiero que un resultado quede como respaldo pendiente cuando falle el SSD, para no asumir que está protegido.
67. Como operador, quiero que el espacio interno insuficiente bloquee nuevos trabajos antes de dañar el sistema, para reducir riesgo operativo.
68. Como operador, quiero que un trabajo activo termine cuando todavía sea seguro, para no perder procesamiento innecesariamente.
69. Como operador, quiero que la cola y sus parámetros se guarden automáticamente, para no depender de un botón de guardado.
70. Como operador, quiero recuperar la cola, las versiones y las aprobaciones después de reiniciar, para continuar desde el último estado confirmado.
71. Como operador, quiero que un trabajo interrumpido sea claramente reintentable, para no confundir un archivo parcial con un resultado válido.
72. Como operador, quiero que la edición use GPU cuando esté disponible, para reducir el tiempo de espera.
73. Como operador, quiero que la edición continúe mediante CPU si no hay GPU disponible, para conservar funcionalidad con rendimiento reducido.
74. Como responsable del evento, quiero que perfiles, modelos y procesamiento funcionen sin internet durante el evento, para evitar dependencias externas.
75. Como responsable del evento, quiero que fotografías, modelos y resultados permanezcan fuera de Git, para proteger privacidad y tamaño del repositorio.
76. Como operador, quiero que la app avise cuando una vista previa supere el tiempo esperado, para comprender que el trabajo sigue en curso.
77. Como responsable del producto, quiero medir por separado el tiempo de vista previa y el tiempo del JPEG completo, para localizar cuellos de botella.
78. Como responsable del producto, quiero que al menos el 95 % de las vistas previas se produzcan en 30 segundos o menos en la computadora objetivo, para mantener margen dentro del flujo global de dos minutos.
79. Como desarrollador, quiero demostrar primero el recorrido completo en la computadora de desarrollo secundaria, para disponer de una versión funcional antes de validar la laptop objetivo.
80. Como desarrollador, quiero usar capturas controladas o autorizadas durante el desarrollo, para no incorporar fotografías privadas de eventos al repositorio.
81. Como operador, quiero acceder a la edición desde la sesión fotográfica finalizada y desde su historial, para recuperar trabajos anteriores.
82. Como operador, quiero que una edición aprobada termine en estado lista para entrega sin generar todavía QR ni impresión, para mantener separados los módulos.

## Implementation Decisions

- **Edición automática** será una capacidad nueva dentro de la misma aplicación local SmartStudio y una iniciativa separada de **Evento, captura y selección**.
- Los tickets pendientes de validación física y operación del primer módulo permanecen abiertos; esta iniciativa puede desarrollarse utilizando la captura simulada o la importación desde carpeta.
- El punto de entrada es una sesión fotográfica finalizada con entre una y tres fotografías seleccionadas y exactamente una fotografía principal.
- La fotografía principal crea automáticamente un trabajo de edición. Las fotografías alternativas requieren una acción explícita del operador.
- La compatibilidad de entrada incluye Sony ARW, Canon CR2 y JPEG. Ambos formatos RAW usan el revelador local y conservan una validación física separada por cámara.
- El RAW es la fuente normal. El JPEG es una fuente de emergencia que requiere autorización explícita y queda registrada en la versión resultante.
- Los originales son inmutables. Vistas previas, JPEG completos, parámetros y estados son derivados independientes asociados con la captura de origen.
- El módulo mantiene trabajos de edición y versiones de edición. Cada trabajo registra fotografía, sesión fotográfica, evento, perfil versionado, parámetros, origen, tiempos y estado.
- Los estados observables incluyen al menos: en cola, procesando, lista para revisar, aprobada, interrumpida, cancelada y fallida.
- La cola es local, persistente, de un solo procesamiento concurrente y ordenada por llegada. Un fallo no bloquea trabajos posteriores.
- Crear un trabajo para la misma fotografía y la misma versión del perfil es idempotente. Reprocesar crea una versión nueva de forma deliberada.
- Cerrar un evento permite terminar trabajos existentes, pero impide solicitar otros nuevos mientras permanezca cerrado.
- Cada trabajo conserva una instantánea del perfil utilizado. Cambiar el perfil del evento afecta trabajos futuros; resultados anteriores solo cambian mediante reprocesamiento explícito.
- El perfil inicial es **Natural de evento**. Prioriza tonos de piel naturales, protección de luces, recuperación moderada de sombras, balance de blancos, contraste y color conservadores.
- La edición contempla orientación, corrección de lente cuando exista información utilizable, exposición, balance de blancos, contraste, color, reducción moderada de ruido y nitidez.
- El retoque facial se limita a suavizado de piel suave o medio, corrección suave de ojos rojos, blanqueamiento dental moderado y mejora ligera de brillo y nitidez de ojos.
- El retoque no modifica facciones, cuerpo, identidad, color o geometría de ojos ni dirección de la mirada. La detección de rostro no identifica personas.
- No existe reencuadre automático. Tampoco se reemplazan fondos, eliminan objetos ni realizan cambios generativos.
- Los ajustes manuales iniciales son exposición, temperatura, intensidad de color y nivel de suavizado de piel. Son acotados, no destructivos y pueden restablecerse a la edición automática.
- La revisión ofrece antes/después, vista dividida, alternancia inmediata, ampliación y desplazamiento.
- La primera salida es una vista previa sRGB ligera. La aprobación solicita después un JPEG sRGB de resolución completa con los mismos parámetros.
- Un JPEG completo solo queda listo para entrega después de comprobar que es legible, tiene las dimensiones esperadas, mantiene su asociación con el original y registra una aprobación vigente.
- Revocar o reabrir una aprobación no borra versiones anteriores. Una nueva aprobación sustituye únicamente cuál versión está vigente.
- Cambiar la fotografía principal invalida el resultado vigente de la sesión fotográfica, conserva sus versiones y requiere procesar la nueva principal.
- El resultado destinado a entrega omite GPS y número de serie de cámara. La relación operativa con evento, sesión fotográfica y captura se conserva localmente.
- Los resultados derivados, parámetros y aprobaciones se respaldan al SSD mediante el mecanismo verificado de la aplicación. Un fallo deja el respaldo pendiente y no detiene automáticamente el procesamiento interno.
- El espacio interno insuficiente impide nuevos trabajos. Un trabajo activo puede terminar únicamente cuando existe margen seguro.
- Al reiniciar, los trabajos que estaban procesando se recuperan como interrumpidos y reintentables. Los archivos parciales no se consideran versiones válidas.
- El módulo usa GPU cuando resulte adecuado y dispone de una ruta funcional por CPU. La ausencia de GPU reduce rendimiento, no elimina la función.
- La operación normal no requiere internet. Los recursos necesarios deben estar instalados antes del evento y permanecer fuera de Git cuando sean binarios, modelos, fotografías o resultados.
- El primer entorno funcional es la computadora de desarrollo secundaria con Windows 10 Pro, Intel Core i7-10700K, 16 GB de RAM y NVIDIA GeForce RTX 3060 de 12 GB.
- La validación final de rendimiento corresponde a la computadora objetivo con Windows 11, Ryzen 5 240, 16 GB de RAM y NVIDIA GeForce RTX 5050 Laptop de 8 GB.
- No se crea una pantalla interna de QA ni herramientas de QA dentro de la aplicación para esta iniciativa.

## Testing Decisions

- Esta etapa de especificación no ejecutará QA, no abrirá la aplicación para inspección manual ni añadirá una pantalla de QA. La verificación se realizará después de cada incremento de implementación según su riesgo.
- La frontera automatizada principal será la aplicación completa mediante el precedente existente de Playwright, servidor local real y directorio temporal aislado.
- El recorrido principal comenzará en la captura simulada o importada y observará desde la interfaz: fotografía principal, cola, vista previa, ajustes, aprobación, JPEG completo, reinicio y recuperación.
- Las verificaciones deben afirmar comportamiento observable y archivos derivados, no algoritmos internos, clases, bibliotecas o detalles del modelo utilizado.
- Desde el mismo recorrido se comprobará que los originales no cambian, las versiones permanecen asociadas, la autorización JPEG queda registrada y los resultados completos son legibles.
- Se cubrirán procesamiento normal desde RAW, autorización desde JPEG, archivo corrupto o incompatible, cancelación, fallo, reintento, reinicio, CPU sin GPU, espacio insuficiente y fallo del SSD.
- Se verificará que nuevas sesiones fotográficas continúan mientras existe un trabajo de edición y que la cola conserva orden e idempotencia.
- Se verificarán perfiles versionados, ajustes acotados, restablecimiento, reprocesamiento, aprobación, revocación y cambio de fotografía principal.
- La calidad visual utilizará fotografías controladas que representen una persona, grupos, tonos de piel diversos, ropa clara y oscura, exposición moderadamente incorrecta y fondo controlado.
- Las fotografías privadas de eventos reales, modelos y resultados no se incorporarán a Git. Los fixtures versionados deberán ser controlados y contar con autorización adecuada.
- La comparación visual de referencia y la inspección manual quedarán pendientes hasta que el usuario solicite explícitamente la etapa de QA correspondiente.
- El rendimiento medirá por separado tiempo hasta vista previa, tiempo hasta JPEG completo, uso de CPU/GPU, errores y capacidad de continuar capturando.
- El objetivo final es que al menos el 95 % de las vistas previas estén disponibles en 30 segundos o menos en la computadora objetivo. Las mediciones iniciales en la computadora de desarrollo secundaria serán informativas, no sustituyen esa validación.
- Los flujos integrales existentes de captura simulada, persistencia, selección y seguridad operativa constituyen el precedente de pruebas del repositorio.
- No se adopta TDD como metodología global. Cada incremento implementado se verificará posteriormente mediante la combinación proporcional de pruebas automatizadas, archivos de referencia, mediciones y, cuando se autorice, inspección visual.

## Out of Scope

- Generación de QR, servidor de descarga y entrega a invitados.
- Impresión y selección de impresora.
- Mensajes manuscritos o mecanografiados desde iPad.
- Libro digital y generación de PDF.
- Reconocimiento o identificación de personas.
- Modificación de facciones, cuerpo, identidad, color o forma de ojos.
- Reemplazo de fondo, eliminación de objetos y edición generativa.
- Reencuadre o recorte automático.
- Curvas, máscaras manuales, edición por zonas, capas y un editor fotográfico avanzado.
- Ojos artificialmente agrandados, cambio de dirección de mirada o blanqueamiento dental fuerte.
- Procesamiento automático de todas las fotografías alternativas.
- Compatibilidad inicial con formatos RAW distintos de Sony ARW y Canon CR2.
- Servicios obligatorios en la nube, APIs pagadas o descargas necesarias durante un evento.
- Administración definitiva de retención y limpieza de versiones.
- Creación de perfiles personalizados desde la interfaz en la primera entrega.
- Cerrar las validaciones físicas pendientes de la Sony A7 IV o la validación operativa final del módulo anterior.
- Una pantalla o modo de QA dentro de la aplicación.

## Further Notes

- El objetivo global confirmado sigue siendo completar desde **Revisar serie** hasta QR listo en menos de dos minutos. El objetivo de 30 segundos corresponde a la vista previa del módulo de edición y reserva margen para aprobación y módulos posteriores.
- La primera demostración funcional debe recorrer selección de principal, finalización de sesión fotográfica, procesamiento local, comparación antes/después, ajuste, aprobación, generación completa y recuperación después de reiniciar.
- La ZV-E10 II puede utilizarse para comprobar el flujo de carpeta y archivos Sony antes de la A7 IV, pero no sustituye la validación específica de la cámara objetivo.
- La selección de herramientas de revelado RAW, procesamiento facial y aceleración todavía no es una decisión arquitectónica confirmada. Debe investigarse mediante incrementos pequeños antes de comprometer una solución definitiva.
- No se crea un ADR en esta etapa porque la conversación cerró requisitos y comportamiento operativo, no una decisión arquitectónica concreta.
