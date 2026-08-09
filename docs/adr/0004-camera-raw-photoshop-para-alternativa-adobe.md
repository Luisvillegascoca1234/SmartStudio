# ADR 0004 — Camera Raw y Photoshop para la alternativa Adobe

**Estado:** aceptada

## Contexto

La versión local de SmartStudio utiliza darktable como revelador RAW principal y MediaPipe/OpenCV para el retoque conservador. El usuario quiere evaluar separadamente una alternativa que aproveche las aplicaciones oficiales de Adobe sin trasladar a ellas el control operativo de eventos, sesiones fotográficas, selección, cola, revisión, aprobación y respaldo.

La alternativa debe preservar originales, funcionar durante el evento sin conexión continua a internet, conservar la revisión del operador y permitir una recuperación explícita cuando Adobe no esté disponible. Lightroom Classic, una extensión UXP y las funciones generativas aumentarían el alcance antes de demostrar el recorrido mínimo.

## Decisión

La rama Adobe desarrollará primero una prueba de concepto en la que SmartStudio actúa como orquestador y fuente de verdad. Adobe Camera Raw realiza el revelado mediante un preset versionado y Photoshop ejecuta una Action mediante un Droplet para producir el resultado fotográfico.

El primer flujo no utiliza Lightroom ni Lightroom Classic. `SmartStudio-Natural` es la automatización predeterminada y `SmartStudio-Fondo` se solicita explícitamente después de revisar el resultado Natural. Photoshop produce un JPEG sRGB de resolución completa en una sola ejecución; SmartStudio deriva su vista previa y exige aprobación del operador.

Una máscara, borde o retoque defectuoso queda en `Necesita revisión en Photoshop`. La corrección manual utiliza un PSD, genera una versión de edición nueva y vuelve a requerir revisión. Firefly y otras funciones generativas no forman parte de la ruta indispensable.

Si Adobe no está disponible, SmartStudio puede ofrecer la versión local basada en darktable solamente mediante una decisión explícita y registrando el motor de origen. Una extensión UXP se considerará únicamente si el prototipo demuestra que Action y Droplet no proporcionan suficiente control o trazabilidad.

## Motivo

Camera Raw y Photoshop permiten evaluar el revelado, las máscaras y el retoque oficiales de Adobe sin construir inicialmente un editor propio ni incorporar un catálogo adicional. Mantener SmartStudio como fuente de verdad conserva el flujo operativo ya verificado y limita la integración a un proceso externo y a carpetas locales de intercambio.

Action y Droplet constituyen el mecanismo oficial más pequeño para demostrar el recorrido. Separar las variantes Natural y Fondo evita aplicar una corrección de fondo sin decisión del operador. Procesar una sola vez a resolución completa elimina diferencias entre una vista previa y una segunda exportación posterior.

## Consecuencias

- La alternativa Adobe requiere una suscripción activa, Photoshop estable y una versión compatible de Camera Raw.
- Presets, Actions, Droplets, modelos, copias de trabajo y resultados se preparan localmente y permanecen fuera de Git cuando corresponda.
- La comprobación previa debe detectar dependencias faltantes antes de iniciar trabajos Adobe.
- SmartStudio debe persistir motor, versiones de preset y Action, estados externos, tiempos y asociaciones de archivos.
- La cola ejecuta un trabajo Adobe a la vez y pausa nuevas operaciones de Photoshop durante una corrección manual.
- La integración debe aislar archivos parciales, tardíos, ilegibles o asociados con otro trabajo.
- La operación normal no depende de conexión continua a internet ni de edición generativa.
- La alternativa no se considera operativa hasta validar calidad, recuperación, funcionamiento offline y rendimiento en la computadora objetivo.
- El ADR 0002 permanece aceptado para la versión local basada en darktable. Este ADR no lo reemplaza y ambas alternativas deben permanecer separadas.
