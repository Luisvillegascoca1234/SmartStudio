# Contexto del dominio

## Propósito

El proyecto busca automatizar localmente el flujo de trabajo de un miniestudio fotográfico instalado temporalmente en bodas y eventos.

Este documento contiene únicamente contexto confirmado. No constituye todavía una especificación funcional ni una selección de arquitectura.

## Flujo previsto

El contexto de trabajo contempla:

1. Conectar una cámara Sony A7 IV a una computadora.
2. Recibir automáticamente las fotografías tomadas.
3. Procesar archivos RAW localmente.
4. Aplicar una edición automática consistente.
5. Trabajar con iluminación y fondo estandarizados cuando estén disponibles.
6. Admitir fotografías tomadas en condiciones menos controladas.
7. Preparar imágenes para revisión, selección, entrega o impresión.
8. Reducir el tiempo requerido por fotografía.

Los detalles, excepciones y criterios de aceptación deberán resolverse mediante `grill-me` antes de convertirse en una especificación.

## Flujo operativo confirmado

- Solo puede existir una sesión fotográfica operativa activa a la vez.
- Una sesión fotográfica puede contener varias series cortas de capturas.
- El operador inicia y cierra cada serie manualmente.
- Después de revisar una serie, el operador selecciona hasta tres fotografías y marca exactamente una como principal.
- La aplicación puede recomendar candidatas y advertir problemas de calidad, pero nunca selecciona, descarta ni elimina automáticamente.
- La fotografía principal alimenta los módulos posteriores de edición, aprobación y entrega.
- Los originales se conservan sin modificaciones y todos los cambios operativos se guardan automáticamente.

## Organización funcional

SmartStudio será una sola aplicación local organizada por capacidades. El primer módulo especificado es **Evento, captura y selección**. El siguiente módulo será **Edición automática** y recibirá la fotografía principal de una sesión fotográfica lista para edición. QR, impresión, mensajes desde iPad y libro digital se tratarán posteriormente como capacidades separadas.

## Edición automática confirmada

- La fotografía principal se procesa automáticamente al finalizar una sesión fotográfica; las fotografías alternativas solo se procesan cuando el operador lo solicita.
- La edición funciona localmente y sin una conexión obligatoria a internet. Puede usar GPU cuando esté disponible y continuar mediante CPU con menor rendimiento.
- El procesamiento usa el RAW cuando está disponible. Procesar desde JPEG requiere autorización explícita y el resultado queda identificado como tal.
- La importación manual admite inicialmente Sony ARW y Canon CR2 acompañados por JPG/JPEG. Cada modelo de cámara conserva una validación física separada.
- Los RAW y JPEG originales permanecen inmutables. Cada procesamiento genera una versión derivada con su receta, procedencia, origen y estado de aprobación.
- El único perfil objetivo será **Evento pulido**, completamente automático y orientado inicialmente a iluminación y fondo controlados. Debe producir una corrección visible de evento, mantener piel natural con textura suficiente, recuperar moderadamente luces y sombras y evitar una apariencia HDR.
- La corrección contempla exposición, balance de blancos, contraste, color, reducción moderada de ruido y nitidez.
- El retoque de personas será visible y controlado: uniforma la piel, reduce brillo, rojeces, ojeras e imperfecciones temporales, corrige ojos rojos, mejora ojos y dientes y equilibra la iluminación facial. Conserva textura suficiente y no cambia identidad, facciones, cuerpo, tono natural de piel, tamaño o forma de ojos, color del iris, dirección de la mirada ni rasgos permanentes. Cada operación localizada se omite cuando su máscara no alcanza suficiente confianza.
- No se realizan automáticamente reencuadre, reemplazo arbitrario de fondo, modificación de identidad ni edición generativa. En fotografías del miniestudio puede normalizarse o reemplazarse determinísticamente el fondo mediante una placa limpia validada para el evento, o completarse desde regiones limpias de la misma fotografía cuando la placa no esté disponible. La aplicación protege a las personas y conserva el fondo original cuando la máscara, la placa o el fondo sean inciertos.
- El operador no ajusta parámetros ni elige perfiles. Revisa una comparación antes/después y puede aprobar, rechazar y conservar el original, revocar una aprobación o reintentar un error técnico.
- La aplicación mantiene una cola local que procesa una fotografía a la vez sin bloquear nuevas sesiones fotográficas. Los trabajos y parámetros se recuperan después de un reinicio; los resultados parciales no se consideran válidos.
- La revisión usa una vista previa sRGB derivada del mismo máster retocado sin pérdida que alimenta el JPEG sRGB de resolución completa después de la aprobación. Los resultados aprobados y sus datos se respaldan en el SSD cuando está disponible.
- Una edición solo queda lista para entrega cuando el archivo completo es legible, está asociado con su original y tiene registrada su aprobación. El módulo no genera todavía QR, impresión ni otras salidas.
- El objetivo es que al menos el 95 % de las vistas previas estén disponibles en 30 segundos o menos en la computadora objetivo. El primer recorrido funcional y sus mediciones se realizarán en la computadora de desarrollo secundaria antes de validar la laptop objetivo.

## Estado de implementación confirmado

- Ya funciona localmente el ciclo de eventos, sesiones fotográficas, series, capturas, revisión, selección de hasta tres fotografías y definición de una principal.
- La captura simulada, la importación manual y la observación de una carpeta de Imaging Edge incorporan RAW y JPEG en cualquier orden, conservan los originales y permiten recuperar componentes pendientes.
- La primera edición automática está implementada con cola persistente, procesamiento RAW local, autorización explícita para recurrir al JPEG, alternativas, comparación antes/después, aprobación, rechazo, revocación y generación del JPEG sRGB completo. Los trabajos nuevos usan exclusivamente Evento pulido v1 sin ajustes ni selección de perfil por el operador.
- El revelado RAW utiliza darktable como ruta principal y rawpy/LibRaw como respaldo. Evento pulido v1 ya conserva una receta versionada, produce un máster TIFF sRGB de 16 bits, deriva preview y entrega del mismo máster y aplica corrección visible de piel, ojos, dientes, luz facial y fondo con omisión independiente de regiones inciertas. La calibración visual definitiva con el conjunto autorizado de la Sony A7 IV sigue pendiente.
- Evento pulido conserva el completado determinista ya implementado de un fondo uniforme interrumpido cuando existe confianza suficiente; protege a las personas y omite la operación cuando el fondo o la máscara son inciertos.
- Los trabajos, versiones y aprobaciones se recuperan después de reiniciar. El respaldo al SSD conserva verificación de integridad y los fallos no bloquean la operación interna.
- El 4 de agosto de 2026 se completó un recorrido manual integral en navegador sin errores ni advertencias de consola. La interfaz se comprobó también a 390 × 844 píxeles sin desbordamiento horizontal.
- La verificación automatizada cubre Evento pulido automático, máster de 16 bits, paridad entre preview y entrega, RAW darktable/rawpy, cola y recuperación, versiones, JPEG completo, importación robusta, recepción desde carpeta Sony, omisión selectiva, retoque visible y completado de fondo. La cifra total vigente debe tomarse de la última ejecución de la suite, no de este documento.

## Trabajo pendiente confirmado

- Ejecutar la calibración visual definitiva de Evento pulido v1 con el conjunto externo autorizado de la Sony A7 IV y referencias aprobadas; el motor y el validador de evidencias ya están implementados.
- Validar físicamente la Sony A7 IV por USB mediante Imaging Edge Remote en la laptop objetivo, incluyendo RAW + JPEG, conservación en tarjeta, desconexión, recuperación manual, respaldo y tiempos reales.
- Completar la validación operativa para evento: atajos de teclado, registro técnico y métricas locales, recuperación ante cierres inesperados y prueba de capacidad equivalente a 150 sesiones fotográficas y 1.500 pares RAW + JPEG.
- Medir el percentil 95 del tiempo de vista previa en la laptop objetivo y confirmar que cumple el objetivo de 30 segundos.
- Ejecutar QA visual con fotografías reales autorizadas del miniestudio, especialmente tonos de piel, ropa clara y oscura, ojos, dientes, bordes de persona y completado de fondo.
- Implementar y validar el reemplazo determinista del fondo del miniestudio mediante una placa limpia del evento, matte suave de persona, composición de precisión completa y omisión automática ante incertidumbre. El completado actual desde la misma fotografía permanece como respaldo hasta que esta capacidad supere su validación visual y de rendimiento.
- Los módulos de QR y descarga, impresión, mensajes desde iPad y libro digital todavía no están especificados ni implementados.
- La transferencia a otra computadora debe preservar el repositorio y su historial, pero no debe incorporar a Git fotografías, RAW, modelos, resultados, cachés ni secretos. Las instrucciones operativas de reanudación están en `docs/codex-handoff.md`.

## Entorno objetivo conocido

- Laptop con Windows 11 Home de 64 bits.
- AMD Ryzen 5 240.
- 16 GB de RAM.
- NVIDIA GeForce RTX 5050 Laptop con 8 GB de VRAM.
- GPU integrada AMD Radeon 760M.
- Cámara Sony A7 IV.

La computadora de desarrollo secundaria utiliza Windows 10 Pro, Intel Core i7-10700K, 16 GB de RAM y NVIDIA GeForce RTX 3060 con 12 GB de VRAM. Sus resultados de rendimiento no representan necesariamente los de la laptop objetivo.

## Prioridades confirmadas

- Funcionamiento principalmente local.
- Privacidad de las fotografías.
- Procesamiento rápido.
- Uso de GPU cuando sea adecuado.
- Preferencia por herramientas gratuitas o de código abierto.
- Ausencia de dependencias obligatorias de APIs pagadas.
- Modularidad y posibilidad de evolución.
- Uso personal; no es una plataforma para múltiples clientes.

## Vocabulario inicial

- **Miniestudio:** instalación fotográfica temporal utilizada durante un evento.
- **Evento:** contenedor operativo que agrupa configuración, sesiones fotográficas, fotografías, respaldos y resultados de una boda o actividad.
- **Sesión fotográfica:** trabajo correspondiente a un grupo de invitados; recibe un número automático, hora y una etiqueta opcional.
- **Serie:** conjunto corto de fotografías capturadas dentro de una sesión fotográfica y cerrado manualmente por el operador para revisión.
- **Fotografía principal:** fotografía seleccionada que representa la sesión fotográfica y debe continuar al flujo de edición y aprobación.
- **Fotografía alternativa:** una de hasta dos selecciones adicionales que puede procesarse o entregarse posteriormente.
- **Operador:** persona que controla la aplicación, registra selecciones y confirma las acciones durante el evento.
- **Captura simulada:** par RAW + JPEG incorporado desde una carpeta para reproducir el flujo sin conectar la cámara.
- **Computadora objetivo:** laptop en la que operará principalmente la aplicación durante los eventos.
- **Computadora de desarrollo secundaria:** computadora actual utilizada para desarrollo y pruebas que no dependan del hardware final.
- **RAW:** archivo de imagen con los datos de captura sin el revelado final.
- **Perfil de edición:** conjunto versionado de criterios y parámetros que define el aspecto aplicado a una fotografía dentro de un evento.
- **Evento pulido:** único perfil de edición objetivo, automático y versionado, que combina revelado RAW, corrección visible de piel, ojos, dientes e iluminación facial y completado seguro del fondo sin controles del operador.
- **Límite obligatorio de retoque:** regla que el motor automático no puede superar y que protege identidad, geometría, tono natural de piel, rasgos permanentes y regiones cuya máscara sea incierta.
- **Placa limpia:** fotografía de referencia del fondo del miniestudio sin personas, validada y asociada con un evento para normalizar o reemplazar determinísticamente el fondo de sus fotografías.
- **Matte de persona:** máscara alfa suave que separa a las personas del fondo y distingue persona segura, borde incierto y fondo seguro.
- **Máster retocado:** derivado sRGB de 16 bits, sin compresión JPEG intermedia, del que se generan la vista previa y el JPEG completo de una versión de edición.
- **Versión de edición:** resultado derivado no destructivo asociado con una fotografía, su origen, perfil, parámetros y estado de aprobación.
- **Edición aprobada:** versión elegida por el operador y preparada para generar el archivo completo listo para entrega.
