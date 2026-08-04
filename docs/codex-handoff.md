# Reanudación del proyecto en otra computadora con Codex

Este documento permite continuar SmartStudio desde otra computadora sin depender del historial del chat. Antes de trabajar, Codex debe leer `AGENTS.md`, `CONTEXT.md`, este documento y únicamente la documentación relacionada con la tarea que vaya a ejecutar.

## Estado del producto

Están implementados y verificados:

- Evento, sesiones fotográficas, series, captura simulada, importación RAW + JPEG, revisión, selección y fotografía principal.
- Recepción local desde la carpeta `Save in` de Imaging Edge Remote, sin afirmar todavía que la conexión USB física esté validada.
- Cola persistente de edición automática, revelado RAW principal con darktable y respaldo con rawpy/LibRaw.
- Perfil Natural de evento, corrección de lente, análisis facial, retoque conservador, segmentación de personas y completado determinista de fondo uniforme.
- Comparación original/edición, vista dividida, ampliación, desplazamiento, ajustes acotados, versiones, alternativas, aprobación, revocación y JPEG sRGB completo.
- Respaldo verificable al SSD, recuperación tras reinicio y continuidad de nuevas sesiones mientras se procesa una edición.

La última verificación integral del 4 de agosto de 2026 terminó con:

- `pnpm typecheck`: aprobado.
- `pnpm build`: aprobado.
- `pnpm test:e2e`: 30 de 30 pruebas aprobadas.
- Recorrido manual completo en navegador: aprobado, sin errores ni advertencias de consola.
- Vista adaptable de 390 × 844 píxeles: sin desbordamiento horizontal.

Los datos de prueba se reiniciaron después del QA. En la computadora de origen `.smartstudio-data/` quedó sin eventos, capturas ni trabajos; solo se conservaron los modelos descargados.

## Estado de Git antes del traslado

- Repositorio remoto: `origin`, `https://github.com/Luisvillegascoca1234/SmartStudio.git`.
- Rama actual al preparar este documento: `feat/ticket-01-simulated-flow`.
- Último commit existente: `3101ebd feat: add local automatic editing workflow`.
- La implementación posterior a ese commit está todavía en el árbol de trabajo, con archivos modificados y archivos nuevos sin seguimiento.
- No se creó ningún commit ni se hizo push automáticamente, de acuerdo con la regla del proyecto que exige autorización explícita.

Abrir el repositorio remoto desde otra computadora antes de publicar estos cambios no recuperará la implementación actual. Antes del traslado hay que revisar los cambios, autorizar un commit y hacer push, o transferir el árbol de trabajo mediante un medio privado equivalente.

## Archivos que deben viajar mediante Git

Además del código y las pruebas, el traslado debe incluir los cambios actuales de:

- `CONTEXT.md`, `README.md`, especificaciones y tickets de `.scratch/`.
- ADRs de `docs/adr/` y referencias operativas de `docs/`.
- Cliente React, servidor local, tipos compartidos y configuración de Vite.
- Scripts Python, requisitos y preparación de modelos.
- Pruebas E2E, incluida la cobertura del completado de fondo uniforme.

Antes de confirmar los cambios, ejecutar `git status` y `git diff` para comprobar la lista exacta. No añadir fotografías, RAW, resultados ni modelos.

## Datos que no deben viajar mediante Git

- `.smartstudio-data/`, incluidos modelos, eventos, capturas, vistas previas y resultados.
- Fotografías reales, archivos ARW/CR2/JPEG privados y fixtures no autorizados.
- Carpetas de recepción de Imaging Edge, rutas de SSD, cachés, archivos temporales y secretos.

Los modelos de MediaPipe pueden reconstruirse en la computadora nueva con `pnpm setup:vision`. Si se necesitan fotografías reales para una validación física, deben transferirse por un medio privado y mantenerse fuera del repositorio.

## Preparación de la computadora nueva

Requisitos conocidos:

- Windows 10 u 11 de 64 bits.
- Git.
- Node.js 24.18.0 y pnpm 9.15.4.
- Python 3.11 o posterior.
- darktable 5.6 o posterior.

Después de clonar la rama que contenga los cambios publicados:

```powershell
pnpm install
python -m pip install -r requirements-raw.txt
winget install --id darktable.darktable --exact
pnpm setup:vision
pnpm check
pnpm test:e2e
pnpm dev
```

La interfaz debe quedar disponible en `http://localhost:5173`. La aplicación recreará `.smartstudio-data/` localmente.

## Cómo continuar en Codex

1. Iniciar sesión en Codex desde la otra computadora y abrir el repositorio clonado.
2. Si esta tarea aparece sincronizada, continuarla desde allí. Si no aparece, crear una tarea nueva y pedir: `Lee AGENTS.md, CONTEXT.md y docs/codex-handoff.md; continúa desde el trabajo pendiente confirmado`.
3. Verificar con `git status`, `git branch --show-current` y `git log -1 --oneline` que la rama y el commit esperados estén presentes.
4. No volver a implementar lo que figura como completado; usar las pruebas existentes como evidencia y elegir el siguiente ticket pendiente.
5. Mantener el flujo del proyecto: `grill-me`, `to-spec`, `to-tickets`, `implement`, `code-review`. No crear commits sin autorización explícita.

## Próximas tareas

1. Publicar de forma segura el árbol de trabajo actual después de revisión y autorización del usuario.
2. Instalar y verificar el entorno en la computadora nueva.
3. Validar la Sony A7 IV y Imaging Edge Remote con hardware real siguiendo `docs/sony-a7iv-usb-validation.md`.
4. Completar `.scratch/evento-captura-seleccion/issues/07-validacion-operacion-evento.md`.
5. Medir rendimiento en la laptop objetivo y ejecutar QA visual con fotografías reales autorizadas.
6. Iniciar por separado la definición de QR/descarga, impresión, mensajes desde iPad y libro digital cuando el usuario lo solicite.
