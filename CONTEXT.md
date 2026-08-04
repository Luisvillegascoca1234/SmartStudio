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
- Los RAW y JPEG originales permanecen inmutables. Cada procesamiento genera una versión derivada con sus parámetros, origen y estado de aprobación.
- El perfil inicial será **Natural de evento**, orientado a iluminación y fondo controlados, piel natural, recuperación moderada de luces y sombras y ausencia de apariencia HDR.
- La corrección contempla exposición, balance de blancos, contraste, color, reducción moderada de ruido y nitidez.
- El retoque de personas será conservador: suavizado de piel suave, corrección de ojos rojos, blanqueamiento dental moderado y mejora ligera de brillo y nitidez de ojos. No cambia facciones, cuerpo, tamaño o forma de ojos, color del iris ni dirección de la mirada.
- No se realizan automáticamente reencuadre, reemplazo de fondo, eliminación de objetos, modificación de identidad ni edición generativa.
- El operador revisa una comparación antes/después y conserva la decisión final. Puede ajustar exposición, temperatura, intensidad de color y suavizado de piel, reprocesar, aprobar, revocar una aprobación o volver al original.
- La aplicación mantiene una cola local que procesa una fotografía a la vez sin bloquear nuevas sesiones fotográficas. Los trabajos y parámetros se recuperan después de un reinicio; los resultados parciales no se consideran válidos.
- La revisión usa una vista previa sRGB y, después de la aprobación, se genera un JPEG sRGB de resolución completa. Los resultados aprobados y sus datos se respaldan en el SSD cuando está disponible.
- Una edición solo queda lista para entrega cuando el archivo completo es legible, está asociado con su original y tiene registrada su aprobación. El módulo no genera todavía QR, impresión ni otras salidas.
- El objetivo es que al menos el 95 % de las vistas previas estén disponibles en 30 segundos o menos en la computadora objetivo. El primer recorrido funcional y sus mediciones se realizarán en la computadora de desarrollo secundaria antes de validar la laptop objetivo.

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
- **Versión de edición:** resultado derivado no destructivo asociado con una fotografía, su origen, perfil, parámetros y estado de aprobación.
- **Edición aprobada:** versión elegida por el operador y preparada para generar el archivo completo listo para entrega.
