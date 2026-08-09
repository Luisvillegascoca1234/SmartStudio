# Especificación: Edición automática Adobe

**Status:** ready-for-agent

## Problem Statement

SmartStudio ya dispone de una versión local de **Edición automática**, pero el operador quiere evaluar una alternativa que aproveche el revelado oficial de Adobe Camera Raw y las capacidades de retoque de Photoshop. La alternativa debe integrarse con el flujo existente sin convertir a Photoshop en la aplicación que organiza el evento ni obligar al operador a cambiar de herramienta para cada fotografía.

Una automatización Adobe sin coordinación puede dejar ventanas abiertas, resultados sin asociación, archivos parciales, máscaras defectuosas o trabajos detenidos cuando Photoshop requiere atención. También puede introducir dependencias de licencia, modelos descargados o funciones en línea que no son aceptables durante un evento. El operador necesita que SmartStudio mantenga el control de la cola, identifique el origen Adobe de cada versión de edición, permita una recuperación explícita mediante darktable y reserve la corrección manual para los casos que realmente la necesiten.

La primera meta es una prueba de concepto funcional y medible. No se considerará operativa hasta demostrar calidad visual, funcionamiento sin conexión continua a internet, recuperación ante fallos y rendimiento suficiente en la computadora objetivo.

## Solution

Incorporar en la rama Adobe una alternativa del módulo **Edición automática** en la que SmartStudio continúe controlando sesiones fotográficas, selección, cola, versiones de edición, revisión, aprobación y respaldo. Adobe Camera Raw realizará el revelado mediante un preset versionado y Photoshop ejecutará una Action a través de un Droplet para producir una salida JPEG sRGB de resolución completa.

La fotografía principal entrará automáticamente a la cola al finalizar la sesión fotográfica. La primera versión utilizará `SmartStudio-Natural`; después de revisarla, el operador podrá solicitar explícitamente `SmartStudio-Fondo` como una versión de edición nueva. SmartStudio derivará la vista previa del mismo JPEG completo que posteriormente podrá aprobarse, evitando una segunda ejecución cuyos resultados pudieran diferir.

La mayoría de las fotografías deberán revisarse y aprobarse desde SmartStudio. Cuando una máscara, un borde o un retoque sean defectuosos, el operador marcará la versión como `Necesita revisión en Photoshop`. SmartStudio pausará los nuevos trabajos Adobe mientras exista una corrección manual activa, conservará un PSD, detectará el resultado guardado y lo presentará como otra versión que requiere revisión.

La prueba de concepto comenzará con un preset fijo. Antes de considerar operativa la alternativa, deberá conservar los ajustes acotados ya confirmados de exposición, temperatura, intensidad de color y suavizado de piel. Si Adobe no está disponible, SmartStudio podrá ofrecer la versión local basada en darktable únicamente mediante una decisión explícita y registrando el motor de origen.

## User Stories

1. Como operador, quiero evaluar la alternativa Adobe como prueba de concepto antes de usarla en un evento, para no depender de un flujo que todavía no demostró estabilidad.
2. Como operador, quiero que SmartStudio siga siendo la aplicación que controla el evento, para no dividir el estado operativo entre varias herramientas.
3. Como operador, quiero utilizar Adobe Camera Raw para revelar el RAW, para aprovechar perfiles y correcciones fotográficas oficiales de Adobe.
4. Como operador, quiero utilizar Photoshop para el retoque y la corrección del fondo, para aprovechar sus capacidades de selección y edición de píxeles.
5. Como operador, quiero que Lightroom Classic quede fuera del primer flujo, para evitar un catálogo y un estado adicionales que SmartStudio tendría que sincronizar.
6. Como operador, quiero que la fotografía principal entre automáticamente al procesamiento Adobe al finalizar la sesión fotográfica, para conservar el flujo ya confirmado.
7. Como operador, quiero que una fotografía alternativa se procese solamente cuando lo solicite, para no consumir tiempo ni recursos innecesarios.
8. Como operador, quiero que el RAW sea la fuente normal del procesamiento Adobe, para obtener el mejor punto de partida disponible.
9. Como operador, quiero autorizar explícitamente el uso del JPEG cuando el RAW falte o no pueda procesarse, para mantener visible la degradación del origen.
10. Como operador, quiero que los RAW y JPEG originales permanezcan inmutables, para conservar siempre la captura original.
11. Como operador, quiero que SmartStudio prepare una copia de trabajo identificada para Adobe, para no entregar los originales como archivos modificables.
12. Como operador, quiero que cada copia de trabajo conserve una asociación inequívoca con evento, sesión fotográfica y fotografía, para impedir que un resultado se asigne a la captura equivocada.
13. Como operador, quiero que Camera Raw aplique un preset `SmartStudio Natural Adobe` versionado, para producir un aspecto coherente entre grupos de invitados.
14. Como operador, quiero que el preset contemple perfil de cámara, lente, balance de blancos, exposición, luces, sombras, contraste, color, ruido y nitidez, para cubrir el revelado fotográfico base.
15. Como operador, quiero que el primer prototipo pueda usar un preset fijo, para validar el recorrido Adobe antes de integrar parámetros variables.
16. Como operador, quiero conservar antes de la operación real los ajustes de exposición, temperatura, intensidad de color y suavizado de piel, para no perder controles ya confirmados.
17. Como operador, quiero que esos ajustes permanezcan acotados, para evitar resultados extremos durante una operación rápida.
18. Como operador, quiero que cada evento fije la versión del preset y la Action, para que una actualización no cambie el aspecto a mitad del evento.
19. Como operador, quiero que los cambios de preset o Action afecten solo trabajos futuros, para conservar la reproducibilidad de resultados existentes.
20. Como operador, quiero reprocesar explícitamente una fotografía con una combinación actualizada, para adoptar el cambio sin sobrescribir versiones anteriores.
21. Como operador, quiero que `SmartStudio-Natural` sea la automatización predeterminada, para obtener primero el resultado conservador aplicable a la mayoría de las fotografías.
22. Como operador, quiero que `SmartStudio-Natural` aplique revelado y retoque conservador sin completar el fondo, para separar claramente las dos intenciones de procesamiento.
23. Como operador, quiero solicitar `SmartStudio-Fondo` únicamente después de revisar el resultado Natural, para no corregir el fondo sin una decisión consciente.
24. Como operador, quiero que `SmartStudio-Fondo` cree una versión de edición nueva, para comparar ambas alternativas sin perder la primera.
25. Como operador, quiero que la corrección del fondo se limite al fondo uniforme del miniestudio, para evitar reemplazos arbitrarios de escena.
26. Como operador, quiero que la automatización conserve cabello, piel, ropa, gafas, aretes y la silueta, para proteger detalles importantes de las personas.
27. Como operador, quiero que una máscara o un borde inciertos no se aprueben automáticamente, para evitar entregar un recorte defectuoso.
28. Como operador, quiero que Photoshop produzca un JPEG sRGB de resolución completa en una sola ejecución, para evitar trabajo duplicado y diferencias entre vista previa y entrega.
29. Como operador, quiero que SmartStudio derive la vista previa del JPEG completo, para revisar exactamente la misma edición que podría aprobarse.
30. Como operador, quiero que el JPEG completo se compruebe antes de mostrarse como válido, para no revisar archivos dañados o incompletos.
31. Como operador, quiero que la comprobación confirme legibilidad, dimensiones, asociación y metadatos permitidos, para mantener la integridad del resultado.
32. Como operador, quiero que la copia destinada a entrega omita GPS y número de serie de la cámara, para proteger información innecesaria.
33. Como operador, quiero comparar original y edición desde SmartStudio, para conservar una única interfaz de decisión.
34. Como operador, quiero ampliar y desplazar la comparación, para revisar piel, ojos, dientes, cabello, accesorios y bordes.
35. Como operador, quiero aprobar el resultado Adobe solamente después de revisarlo, para conservar la decisión final.
36. Como operador, quiero que una versión de edición registre que fue producida por Adobe, para distinguirla de una versión producida por darktable.
37. Como operador, quiero que cada versión registre preset, Action, parámetros, origen RAW/JPEG y fecha, para comprender cómo se produjo.
38. Como operador, quiero que `Reprocesar` cree una versión nueva, para conservar el historial y evitar sobrescrituras.
39. Como operador, quiero revocar una aprobación sin eliminar la versión, para volver a revisar el resultado.
40. Como operador, quiero que cambiar la fotografía principal invalide el resultado vigente de la sesión fotográfica sin borrar versiones, para evitar entregar la fotografía equivocada.
41. Como operador, quiero que la cola Adobe procese una fotografía a la vez, para evitar que varias Actions compitan por la misma instancia de Photoshop.
42. Como operador, quiero continuar creando sesiones fotográficas mientras Adobe procesa una fotografía anterior, para no detener la captura de invitados.
43. Como operador, quiero que un trabajo que espera revisión manual no bloquee los trabajos siguientes, para mantener el avance de la cola.
44. Como operador, quiero que la cola muestre evento, sesión fotográfica, fotografía, motor, estado y tiempo transcurrido, para entender qué está ocurriendo.
45. Como operador, quiero distinguir los estados en cola, procesando, lista para revisar, necesita revisión en Photoshop, aprobada, interrumpida, cancelada y fallida, para decidir la siguiente acción.
46. Como operador, quiero cancelar un trabajo Adobe sin modificar originales ni aceptar resultados parciales, para recuperar recursos con seguridad.
47. Como operador, quiero reintentar un trabajo fallido o interrumpido, para recuperarme sin repetir la captura y selección.
48. Como operador, quiero que un reintento del mismo intento no produzca asociaciones ni archivos duplicados, para mantener un estado inequívoco.
49. Como operador, quiero que un fallo de una fotografía no bloquee las posteriores, para conservar la continuidad del evento.
50. Como operador, quiero que los trabajos y parámetros se recuperen después de reiniciar SmartStudio, para continuar desde el último estado confirmado.
51. Como operador, quiero que un trabajo activo durante un cierre inesperado se recupere como interrumpido y reintentable, para no aceptar archivos parciales.
52. Como operador, quiero que SmartStudio detecte si Photoshop o Camera Raw no están disponibles, para conocer la causa antes de iniciar un trabajo.
53. Como operador, quiero que SmartStudio advierta cuando un procesamiento supere 30 segundos, para saber que continúa en curso pero excedió el objetivo.
54. Como operador, quiero que el primer límite de interrupción sea de dos minutos, para evitar esperas indefinidas durante la prueba de concepto.
55. Como responsable del producto, quiero ajustar ese límite después de medir la integración real, para basar la operación en evidencia.
56. Como operador, quiero que una salida recibida después de interrumpir un trabajo no se acepte silenciosamente, para evitar resultados tardíos ambiguos.
57. Como operador, quiero marcar una versión como `Necesita revisión en Photoshop`, para separar una corrección manual de una aprobación normal.
58. Como operador, quiero abrir en Photoshop únicamente la fotografía que necesita corrección, para no interrumpir las fotografías que ya están correctas.
59. Como operador, quiero que una corrección manual utilice un PSD, para conservar capas y permitir reparar detalles finos.
60. Como operador, quiero que los nuevos trabajos Adobe se pausen mientras realizo una corrección manual, para impedir que una Action altere el documento abierto.
61. Como operador, quiero que la captura y las demás funciones de SmartStudio continúen durante la corrección manual, para no detener el evento completo.
62. Como operador, quiero que SmartStudio detecte el PSD guardado y produzca una versión de edición nueva, para registrar la corrección sin sobrescribir el resultado automático.
63. Como operador, quiero revisar nuevamente una corrección manual antes de aprobarla, para no asumir que guardar equivale a aceptar.
64. Como operador, quiero reanudar claramente la cola Adobe al finalizar la corrección manual, para continuar sin acciones ocultas.
65. Como operador, quiero conservar el PSD durante todo el evento, para poder volver a corregirlo si fuera necesario.
66. Como operador, quiero conservar el PSD hasta verificar su respaldo al SSD, para no perder la única versión reversible.
67. Como responsable del producto, quiero tratar la limpieza posterior de PSD como una iniciativa separada, para no eliminar archivos automáticamente durante el evento.
68. Como operador, quiero que los JPEG, PSD, parámetros y aprobaciones se incorporen al respaldo del evento, para proteger los resultados derivados.
69. Como operador, quiero que un fallo del SSD deje el respaldo pendiente sin detener automáticamente la edición, para continuar mientras exista espacio interno seguro.
70. Como operador, quiero que el espacio interno crítico impida iniciar nuevos trabajos Adobe, para evitar resultados incompletos o daños operativos.
71. Como operador, quiero ejecutar una comprobación previa antes del evento, para detectar dependencias faltantes con tiempo de corregirlas.
72. Como operador, quiero que la comprobación previa valide Photoshop estable, Camera Raw, preset, Droplet y carpetas de intercambio, para conocer si la ruta Adobe está preparada.
73. Como operador, quiero que la comprobación previa valide los recursos necesarios para operar sin conexión continua a internet, para evitar descargas durante el evento.
74. Como operador, quiero que un fallo de preparación bloquee los trabajos Adobe pero no la captura, para poder seguir fotografiando y recuperarme después.
75. Como operador, quiero que Photoshop permanezca disponible sin ocupar el primer plano durante el procesamiento normal, para no distraerme de SmartStudio.
76. Como operador, quiero que Photoshop pase al frente solo cuando necesite intervención, para distinguir claramente la operación automática de la manual.
77. Como operador, quiero que la alternativa Adobe funcione sin conexión continua a internet, para no depender de la conectividad del evento.
78. Como responsable del evento, quiero que Firefly y otras funciones generativas queden fuera de la ruta indispensable, para evitar internet, créditos y cambios no confirmados.
79. Como responsable del evento, quiero que presets, Actions, modelos, fotografías y resultados permanezcan fuera de Git cuando corresponda, para proteger privacidad, licencias y tamaño del repositorio.
80. Como operador, quiero que la ausencia de Adobe permita ofrecer darktable como alternativa explícita, para disponer de una recuperación local consciente.
81. Como operador, quiero confirmar antes de cambiar a darktable, para no mezclar motores silenciosamente.
82. Como operador, quiero que una versión producida por darktable durante esa recuperación quede identificada, para comprender su origen y reproducibilidad.
83. Como responsable del producto, quiero medir por separado tiempo total de Adobe, tiempo hasta vista previa y tiempo de intervención manual, para localizar cuellos de botella.
84. Como responsable del producto, quiero comprobar el uso de memoria y la continuidad de captura durante el procesamiento, para validar la laptop de 16 GB.
85. Como responsable del producto, quiero que al menos el 95 % de las vistas previas estén disponibles en 30 segundos o menos en la computadora objetivo, para conservar el objetivo del módulo.
86. Como desarrollador, quiero probar automáticamente el recorrido completo sin requerir Photoshop real, para obtener resultados repetibles en cada cambio.
87. Como desarrollador, quiero sustituir únicamente el límite externo de Adobe por un ejecutable controlado, para probar SmartStudio sin simular su comportamiento interno.
88. Como desarrollador, quiero simular éxito, demora, bloqueo, salida inválida, reintento y corrección manual, para cubrir los riesgos observables de la integración.
89. Como responsable del producto, quiero validar separadamente Camera Raw, la Action y el Droplet reales, para demostrar que el contrato automatizado coincide con Adobe.
90. Como responsable del producto, quiero utilizar fotografías controladas o autorizadas con cabello suelto, aretes, gafas, ropa clara y oscura y varias personas, para evaluar los casos de máscara más riesgosos.
91. Como responsable del producto, quiero ejecutar una prueba sin conexión y otra de recuperación ante fallos, para comprobar la preparación operativa.
92. Como responsable del producto, quiero comparar la prueba de concepto Adobe con la versión local antes de elegir una ruta operativa, para basar la decisión en calidad, velocidad y estabilidad.

## Implementation Decisions

- La alternativa Adobe pertenece al módulo **Edición automática** de SmartStudio y se desarrolla separadamente de la versión local basada en darktable. La primera entrega es una prueba de concepto, no una sustitución automática de la versión local.
- SmartStudio sigue siendo la fuente de verdad para eventos, sesiones fotográficas, fotografías, trabajos, versiones de edición, aprobaciones, respaldo y estados operativos.
- Lightroom Classic queda fuera del primer flujo. Adobe Camera Raw realiza el revelado y Photoshop realiza el retoque de píxeles.
- El primer mecanismo de automatización utiliza un preset versionado de Camera Raw, una Action y un Droplet oficial de Photoshop. Una extensión UXP requiere evidencia posterior de que el mecanismo inicial no ofrece control o trazabilidad suficientes.
- La integración Adobe constituye un motor de edición detrás del flujo existente. La selección del motor y el origen RAW/JPEG se registran en cada versión de edición.
- La fotografía principal crea automáticamente un trabajo al finalizar la sesión fotográfica. Las fotografías alternativas conservan la solicitud explícita ya confirmada.
- Los originales permanecen inmutables. SmartStudio entrega a Adobe una copia de trabajo identificada y recibe resultados en carpetas locales de intercambio fuera de Git.
- El flujo normal aplica `SmartStudio-Natural`. `SmartStudio-Fondo` se solicita únicamente después de revisar Natural y produce una versión independiente.
- La prueba de concepto comienza con un preset fijo. La versión operativa debe integrar los ajustes acotados de exposición, temperatura, intensidad de color y suavizado de piel sin convertir SmartStudio en un editor avanzado.
- Cada evento conserva una instantánea de las versiones del preset y la Action. Actualizar recursos afecta trabajos futuros; reprocesar una fotografía anterior es una acción explícita.
- Photoshop produce una única salida JPEG sRGB de resolución completa por procesamiento. SmartStudio deriva la vista previa de esa misma salida y, después de aprobar, declara vigente el JPEG ya validado en lugar de volver a ejecutar Photoshop.
- La salida solo se acepta cuando es legible, tiene dimensiones coherentes, mantiene una asociación inequívoca con la fotografía y cumple la política de metadatos.
- Los estados existentes se amplían con una condición observable `Necesita revisión en Photoshop`. Un archivo parcial, tardío o no asociado nunca constituye una versión válida.
- La cola procesa un trabajo Adobe a la vez. Los trabajos que esperan revisión no bloquean trabajos posteriores, pero una corrección manual activa pausa nuevas operaciones que utilizarían Photoshop.
- La corrección manual crea o conserva un PSD, nunca modifica el original y produce una nueva versión de edición al guardarse. Esa versión vuelve al estado de revisión y no hereda una aprobación automática.
- El PSD se conserva durante el evento y hasta verificar su respaldo al SSD. La política definitiva de limpieza y retención posterior no forma parte de esta iniciativa.
- Una demora superior a 30 segundos genera una advertencia. El límite inicial de interrupción es de dos minutos y queda preparado para ajustarse mediante mediciones posteriores.
- Los trabajos se mantienen persistentes e idempotentes. Reiniciar durante una operación recupera el trabajo como interrumpido y reintentable; resultados tardíos o parciales se aíslan.
- Una comprobación previa valida las dependencias observables de Adobe y las carpetas locales antes del evento. Un fallo impide iniciar trabajos Adobe, pero no impide capturar, seleccionar ni conservar trabajos pendientes.
- La operación normal no requiere conexión continua a internet. Firefly y otras funciones generativas no forman parte de la ruta indispensable.
- Cuando Adobe no esté disponible, SmartStudio puede ofrecer la versión local basada en darktable solo mediante confirmación explícita. La versión resultante conserva identificado su motor y no se mezcla silenciosamente con Adobe.
- La alternativa Adobe requiere un ADR propio porque introduce una dependencia propietaria y contradice la selección de motor aceptada para la versión local. El ADR de darktable permanece vigente para esa otra alternativa.
- No se adopta TDD como metodología global. Cada incremento se verifica después de implementarse con la combinación de pruebas e inspecciones proporcional a su riesgo.

## Testing Decisions

- El seam automatizado principal es la aplicación completa: interfaz en navegador, servidor local real, cola y persistencia reales, y carpetas de intercambio reales dentro de un directorio temporal aislado.
- En las pruebas automatizadas se sustituye únicamente el límite externo de Adobe por un ejecutable controlado. No se simulan la interfaz, el servidor, la cola, la persistencia ni el sistema de archivos de SmartStudio.
- El ejecutable controlado reproduce resultados observables del contrato: salida correcta, demora, interrupción, proceso bloqueado, código de error, archivo ilegible, dimensiones incorrectas, asociación equivocada, resultado tardío y corrección manual guardada.
- Las pruebas E2E con Playwright constituyen el precedente principal. Deben comenzar con captura simulada o importada y observar desde la interfaz la selección, el trabajo Adobe, la revisión, la aprobación, el respaldo, el reinicio y la recuperación.
- Las verificaciones afirman comportamiento visible, estados persistidos y archivos derivados. No acoplan las pruebas a clases internas, comandos concretos de Adobe ni algoritmos de máscara.
- Se verifica que los originales no cambian, las versiones conservan motor, preset, Action y origen, y ningún archivo parcial o tardío se acepta como válido.
- Se cubren `SmartStudio-Natural`, solicitud explícita de `SmartStudio-Fondo`, revisión normal, corrección manual, pausa de la cola Adobe y reanudación.
- Se cubren Adobe ausente, comprobación previa fallida, autorización explícita de darktable, rechazo de la alternativa, cancelación, reintento, reinicio, timeout, SSD fallido y espacio interno crítico.
- La integración real de Camera Raw, Action y Droplet se valida separadamente en la computadora de desarrollo secundaria. Esa comprobación demuestra el contrato de archivos y procesos utilizado por las pruebas automatizadas.
- La calidad visual no se simula. Se valida con fotografías controladas o autorizadas y revisión de cabello, accesorios, gafas, tonos de piel, ropa, grupos y fondo uniforme cuando el usuario autorice la etapa de QA correspondiente.
- La operación offline se comprueba con los recursos y licencia preparados antes de desconectar la red. Firefly no participa en el recorrido obligatorio.
- El rendimiento mide tiempo total, tiempo hasta vista previa, uso de memoria, fallos, reintentos y continuidad de nuevas sesiones fotográficas. La validación final corresponde a la computadora objetivo.
- La prueba de concepto no queda operativa por completar una sola fotografía. Debe superar los recorridos de recuperación, validación real de Adobe, calidad autorizada y el objetivo del percentil 95.

## Out of Scope

- Lightroom y Lightroom Classic en el primer flujo Adobe.
- Sustituir o eliminar la versión local basada en darktable.
- Crear inicialmente una extensión UXP.
- Ejecutar automáticamente `SmartStudio-Fondo` sin decisión del operador.
- Ejecutar Camera Raw o Photoshop dos veces para producir por separado vista previa y JPEG completo.
- Aprobar automáticamente una máscara, un borde, un retoque o una corrección manual.
- Firefly, Generative Fill, Generate Background, Generative Expand y cualquier edición generativa como parte indispensable del evento.
- Reemplazo arbitrario de fondo, cambio de identidad, facciones o cuerpo, reencuadre automático y modificación de color, forma o dirección de los ojos.
- Administración definitiva de retención y limpieza de PSD después del evento.
- Crear presets o Actions desde la interfaz de SmartStudio.
- Sincronización en la nube de fotografías, catálogos o resultados.
- QR y descarga, impresión, mensajes desde iPad y libro digital.
- Cerrar dentro de esta iniciativa la validación física pendiente de la Sony A7 IV y Imaging Edge Remote.
- Una pantalla o modo interno de QA.

## Further Notes

- La alternativa Adobe añade una dependencia propietaria y de pago, pero no una API pagada ni una conexión continua obligatoria durante el evento.
- Photoshop estable es requisito del prototipo operativo; Photoshop Beta no se considera el motor principal para eventos.
- La licencia, Camera Raw, presets, Actions, Droplets y recursos de procesamiento local deben prepararse antes del evento.
- El objetivo global desde `Revisar serie` hasta QR listo permanece fuera de esta iniciativa. El objetivo propio continúa siendo que al menos el 95 % de las vistas previas estén disponibles en 30 segundos o menos en la computadora objetivo.
- La prueba de concepto debe comparar Adobe con la versión local utilizando material autorizado equivalente, sin mezclar estados ni resultados entre ramas.
- La siguiente etapa es convertir esta especificación en tickets pequeños y ordenados mediante `to-tickets`; no corresponde implementar durante `to-spec`.
