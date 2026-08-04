# Reanudación del proyecto en otra computadora con Codex

Este documento permite continuar SmartStudio desde otra computadora sin depender del historial del chat. Antes de trabajar, Codex debe leer `AGENTS.md`, `CONTEXT.md`, este documento y únicamente la documentación relacionada con la tarea que vaya a ejecutar.

## Estado del producto

La versión local basada en darktable ya implementa y verifica:

- Evento, sesiones fotográficas, series, captura simulada, importación RAW + JPEG, revisión, selección y fotografía principal.
- Recepción local desde la carpeta `Save in` de Imaging Edge Remote, sin afirmar todavía que la conexión USB física esté validada.
- Cola persistente de edición automática, revelado RAW principal con darktable y respaldo con rawpy/LibRaw.
- Perfil Natural de evento, corrección de lente, análisis facial, retoque conservador, segmentación de personas y completado determinista de fondo uniforme.
- Comparación original/edición, vista dividida, ampliación, desplazamiento, ajustes acotados, versiones, alternativas, aprobación, revocación y JPEG sRGB completo.
- Respaldo verificable al SSD, recuperación tras reinicio y continuidad de nuevas sesiones mientras se procesa una edición.
- Indicador visual rojo y alineado para el paso actual del flujo, controles de importación reorganizados y controles de simulación ocultos en la interfaz normal. Las pruebas todavía pueden habilitarlos mediante `?simulated-controls=1`.

La última verificación integral del 4 de agosto de 2026 terminó con:

- `pnpm typecheck`: aprobado.
- `pnpm build`: aprobado.
- `pnpm test:e2e`: 30 de 30 pruebas aprobadas.
- Recorrido manual completo en navegador: aprobado, sin errores ni advertencias de consola.
- Vista adaptable de 390 × 844 píxeles: sin desbordamiento horizontal.

Los datos de prueba se reiniciaron después del QA. En la computadora de origen `.smartstudio-data/` quedó sin eventos, capturas ni trabajos; solo se conservaron los modelos descargados.

## Estado de Git y separación de las dos versiones

- Repositorio remoto: `origin`, `https://github.com/Luisvillegascoca1234/SmartStudio.git`.
- Rama estable del repositorio: `main`.
- Versión local ya publicada: `feat/local-darktable-smartstudio`.
- Rama de trabajo para Adobe ya publicada y actualmente seleccionada: `feat/adobe-photoshop-smartstudio`.
- Commit común más reciente al crear ambas ramas: `feae9d9 feat: refine capture workflow controls`.
- La rama remota anterior `feat/ticket-01-simulated-flow` fue reemplazada por `feat/local-darktable-smartstudio` y eliminada del remoto.

Las dos ramas comparten el historial hasta `feae9d9`, pero deben divergir desde ahora:

- `feat/local-darktable-smartstudio` conserva la implementación local con darktable, rawpy/LibRaw, MediaPipe y OpenCV.
- `feat/adobe-photoshop-smartstudio` se usa exclusivamente para especificar, probar e implementar la integración oficial con Photoshop y Adobe Camera Raw.

Cambiar de rama permite trabajar con cada versión por separado en la misma copia del repositorio:

```powershell
git switch feat/local-darktable-smartstudio
git switch feat/adobe-photoshop-smartstudio
```

Antes de cambiar de rama, comprobar siempre `git status`. No trasladar cambios sin confirmar de una versión a la otra. Si se necesita ejecutar ambas simultáneamente, preparar dos copias o dos worktrees con directorios de datos y puertos diferentes.

## Decisión en evaluación: edición oficial mediante Adobe

El usuario quiere evaluar una segunda versión en la que SmartStudio coordine el flujo, pero Photoshop y Adobe Camera Raw oficiales realicen la edición de píxeles. Esta integración todavía no está implementada y no debe presentarse como terminada.

La ruta recomendada para la prueba de concepto es:

1. SmartStudio conserva inmutables el RAW y JPEG originales.
2. Al aprobar la fotografía principal, SmartStudio crea una copia de trabajo en una carpeta `Adobe Inbox`.
3. Adobe Camera Raw aplica un preset versionado, inicialmente `SmartStudio Natural Adobe v1`, para perfil de cámara, lente, exposición, balance de blancos, luces, sombras, color, ruido y nitidez.
4. SmartStudio entrega la copia a un Droplet oficial de Photoshop que ejecuta una Action.
5. Photoshop realiza selección de sujeto, máscara y retoque conservador. La corrección de fondo solo se ejecuta en la variante destinada al fondo.
6. Photoshop exporta un JPEG sRGB y, si se decide conservar edición reversible, un PSD o TIFF con capas en `Adobe Outbox`.
7. SmartStudio valida el archivo, lo registra como una versión de edición de origen Adobe y exige revisión antes de aprobarlo.

Se plantean dos automatizaciones separadas:

- `SmartStudio-Natural`: revelado y retrato sin completar el fondo.
- `SmartStudio-Fondo`: revelado, retrato y corrección del fondo cuando la escena sea apta.

La fotografía real revisada durante el desarrollo demostró que una máscara automática puede recortar cabello suelto, aretes y otros detalles finos. La versión Adobe debe conservar un control de calidad: si la máscara o los bordes son inciertos, el resultado queda en `Necesita revisión en Photoshop` y nunca se aprueba automáticamente.

Photoshop Actions y Droplets son el primer mecanismo a validar porque pertenecen al producto oficial y permiten automatizar secuencias repetibles. Una extensión UXP propia se considerará solamente después de demostrar que el prototipo necesita más control, trazabilidad o comunicación estructurada con SmartStudio.

Referencias oficiales:

- [Crear un Droplet desde una Action](https://helpx.adobe.com/photoshop/desktop/automate-tasks/process-a-batch-of-files/create-a-droplet-from-an-action.html).
- [Presets de Adobe Camera Raw](https://helpx.adobe.com/in/camera-raw/using/presets.html).
- [Select Subject con procesamiento en el dispositivo](https://helpx.adobe.com/photoshop/desktop/make-selections/automatic-color-based-selections/improved-select-subject-and-remove-background-results.html).
- [Remove con modelo local en el dispositivo](https://helpx.adobe.com/photoshop/desktop/repair-retouch/remove-objects-fill-space/remove-unwanted-objects-and-distractions.html).

La integración Adobe introduce una dependencia propietaria y de pago distinta de la decisión aceptada en `docs/adr/0002-darktable-mediapipe-para-edicion-local.md`. Antes de implementarla, Codex debe actualizar la especificación y registrar la decisión arquitectónica real para esta rama. No debe reemplazar ni modificar el ADR de la versión darktable: ambas alternativas deben permanecer documentadas por separado.

## Suscripción y aplicaciones Adobe verificadas

El 4 de agosto de 2026 se verificó en la cuenta oficial de Adobe una suscripción activa **Creative Cloud Pro**, anual con pago mensual. El plan incluye Photoshop, Lightroom, funciones premium de Adobe Firefly y 100 GB de almacenamiento. No hace falta comprar otro plan para construir el prototipo.

En la computadora de desarrollo secundaria estaban instalados:

- Photoshop Beta `27.3`.
- Lightroom de escritorio/cloud `9.3.1`.
- Adobe Camera Raw `18.1.1`.
- Adobe Creative Cloud.

No se encontró Photoshop estable ni Lightroom Classic. Para un flujo operativo de bodas no se debe usar Photoshop Beta como motor principal. Hay que instalar Photoshop estable desde Creative Cloud. Lightroom Classic es opcional para el primer prototipo si Camera Raw y Photoshop cubren el flujo; se instalará si la especificación decide incorporarlo.

No guardar en Git datos de la cuenta Adobe, credenciales, métodos de pago, tokens, cookies ni datos de facturación.

## Funcionamiento de Adobe sin internet

La integración debe funcionar durante el evento sin conexión continua a internet:

- Camera Raw, presets, Actions, Droplets, máscaras y exportación pueden ejecutarse localmente.
- `Select Subject` y `Remove Background` deben configurarse con procesamiento `Device`.
- Los modelos locales necesarios deben descargarse antes del evento.
- La licencia, las aplicaciones y los modelos deben validarse el día anterior al evento.

Internet sigue siendo necesario para instalar las aplicaciones, iniciar sesión, descargar modelos y actualizaciones y validar periódicamente la suscripción. Adobe intenta validar la licencia aproximadamente cada 30 días; el periodo offline depende del tipo y estado del plan. Consultar la [documentación oficial sobre uso sin conexión](https://helpx.adobe.com/es/creative-cloud/kb/internet-connection-creative-cloud-apps.html) antes de cada despliegue.

Firefly, Generative Fill, Generate Background, Generative Expand y algunas funciones de Neural Filters requieren internet o pueden depender de créditos generativos. No deben formar parte de la ruta indispensable para terminar una fotografía durante un evento. Si se incorporan, deben ser una mejora opcional cuando exista conexión, con una alternativa local y un estado de revisión.

## Archivos que deben viajar mediante Git

Además del código y las pruebas, el traslado debe incluir:

- `CONTEXT.md`, `README.md`, especificaciones y tickets de `.scratch/`.
- ADRs de `docs/adr/` y referencias operativas de `docs/`.
- Cliente React, servidor local, tipos compartidos y configuración de Vite.
- Scripts Python, requisitos y preparación de modelos.
- Pruebas E2E, incluida la cobertura del completado de fondo uniforme.
- La documentación y futura integración Adobe, pero nunca instaladores, modelos propietarios ni datos de cuenta.

Antes de confirmar cambios, ejecutar `git status` y `git diff` para comprobar la lista exacta. No añadir fotografías, RAW, resultados ni modelos.

## Datos que no deben viajar mediante Git

- `.smartstudio-data/`, incluidos modelos, eventos, capturas, vistas previas y resultados.
- Fotografías reales, archivos ARW/CR2/JPEG privados y fixtures no autorizados.
- Carpetas `Adobe Inbox` y `Adobe Outbox`, PSD/TIFF/JPEG producidos, carpetas de recepción de Imaging Edge, rutas de SSD, cachés y archivos temporales.
- Modelos descargados por Adobe, instaladores, licencias, credenciales, secretos y cualquier dato de la cuenta Adobe.

Los modelos de MediaPipe pueden reconstruirse en la computadora nueva con `pnpm setup:vision`. Si se necesitan fotografías reales para una validación física o del flujo Adobe, deben transferirse por un medio privado y mantenerse fuera del repositorio.

## Preparación general de la computadora nueva

Requisitos conocidos:

- Windows 10 u 11 de 64 bits.
- Git.
- Node.js 24.18.0 y pnpm 9.15.4.
- Python 3.11 o posterior.

Después de clonar el repositorio:

```powershell
pnpm install
python -m pip install -r requirements-raw.txt
pnpm check
```

La interfaz debe quedar disponible en `http://localhost:5173` después de ejecutar `pnpm dev`. La aplicación recreará `.smartstudio-data/` localmente.

### Preparar la versión local darktable

```powershell
git switch feat/local-darktable-smartstudio
winget install --id darktable.darktable --exact
pnpm setup:vision
pnpm check
pnpm test:e2e
pnpm dev
```

Validar darktable 5.6 o posterior y comprobar OpenCL en cada computadora. La ruta rawpy/LibRaw permanece como respaldo.

### Preparar la futura versión Adobe

```powershell
git switch feat/adobe-photoshop-smartstudio
pnpm install
python -m pip install -r requirements-raw.txt
pnpm check
```

Después:

1. Iniciar sesión en Adobe Creative Cloud con la cuenta que tiene Creative Cloud Pro.
2. Instalar Photoshop estable; no usar Photoshop Beta como motor operativo.
3. Instalar Lightroom Classic solo si la especificación lo incluye.
4. Abrir Photoshop y Camera Raw al menos una vez para activar la licencia.
5. Descargar y verificar los modelos locales que vaya a utilizar el modo `Device`.
6. Crear los presets, Actions y Droplets en la computadora nueva o transferir únicamente sus archivos de configuración mediante un medio privado autorizado.
7. Ejecutar una prueba offline antes de usar la aplicación en un evento.

## Cómo continuar en Codex

1. Iniciar sesión en Codex desde la otra computadora y abrir el repositorio clonado.
2. Ejecutar `git fetch --all --prune`.
3. Elegir explícitamente una de las dos rutas:
   - Local: `git switch feat/local-darktable-smartstudio`.
   - Adobe: `git switch feat/adobe-photoshop-smartstudio`.
4. Si esta tarea aparece sincronizada, continuarla desde allí. Si no aparece, crear una tarea nueva y pedir: `Lee AGENTS.md, CONTEXT.md y docs/codex-handoff.md; verifica la rama actual y continúa desde el trabajo pendiente confirmado sin mezclar las versiones darktable y Adobe`.
5. Verificar con `git status`, `git branch --show-current` y `git log -1 --oneline` que la rama y el commit esperados estén presentes.
6. No volver a implementar lo que figura como completado; usar las pruebas existentes como evidencia y elegir el siguiente ticket pendiente.
7. Mantener el flujo del proyecto: `grill-me`, `to-spec`, `to-tickets`, `implement`, `code-review`. No crear commits sin autorización explícita.

## Próximas tareas

### Comunes y versión local

1. Instalar y verificar el entorno en la computadora nueva.
2. Validar la Sony A7 IV y Imaging Edge Remote con hardware real siguiendo `docs/sony-a7iv-usb-validation.md`.
3. Completar `.scratch/evento-captura-seleccion/issues/07-validacion-operacion-evento.md`.
4. Medir rendimiento en la laptop objetivo y ejecutar QA visual con fotografías reales autorizadas.

### Rama Adobe

1. Instalar Photoshop estable y confirmar su versión y ubicación en la computadora de desarrollo.
2. Actualizar la especificación de edición automática para admitir el motor Adobe sin cambiar los requisitos inmutables, la revisión del operador ni la privacidad de originales.
3. Registrar el ADR específico de la alternativa Adobe y su relación con ADR 0002.
4. Crear tickets para el prototipo Camera Raw + Photoshop Action/Droplet.
5. Construir dos pruebas de concepto: `SmartStudio-Natural` y `SmartStudio-Fondo`.
6. Validar con fotografías autorizadas que incluyan cabello suelto, aretes, gafas, ropa clara/oscura y más de una persona.
7. Integrar `Adobe Inbox`/`Adobe Outbox`, estados, tiempos de espera, validación de salidas y revisión obligatoria.
8. Ejecutar una prueba completa sin internet y otra con funciones opcionales de Firefly.

Los módulos de QR/descarga, impresión, mensajes desde iPad y libro digital siguen pendientes y deben iniciarse por separado cuando el usuario lo solicite.
