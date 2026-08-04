# Local Photo Workflow

Repositorio de una futura aplicación local para automatizar el flujo de trabajo de un miniestudio fotográfico en bodas y eventos.

## Estado

Ya funcionan localmente evento, captura, selección y la primera edición automática. La cola de edición es persistente y recuperable; revela RAW principalmente mediante darktable, conserva rawpy/LibRaw como respaldo y solicita autorización antes de recurrir al JPEG. MediaPipe analiza landmarks, segmenta personas y permite completar conservadoramente un fondo uniforme del miniestudio sin relleno generativo. La transferencia física desde cámara todavía requiere validación con el hardware real; no incluye QR, impresión ni mensajes desde iPad.

## Entorno de desarrollo

- Git con rama principal `main`.
- Node.js `24.18.0` LTS, seleccionado mediante `fnm` y `.node-version`.
- pnpm disponible mediante el entorno de Node/Corepack.
- Python 3.11+ con rawpy/LibRaw como respaldo y MediaPipe/OpenCV para análisis y retoque local.
- darktable 5.6+ para el revelado RAW principal de 16 bits mediante `darktable-cli`.
- Docker y CUDA no son requisitos del proyecto en esta etapa.

La interfaz usa React, Tailwind CSS 4 y componentes shadcn/ui almacenados localmente en `src/components/ui/`. La configuración se conserva en `components.json`; agregar un componente no introduce una dependencia de servicios en línea durante la ejecución.

## Ejecutar el módulo local

```powershell
pnpm install
python -m pip install -r requirements-raw.txt
winget install --id darktable.darktable --exact
pnpm setup:vision
pnpm dev
```

Los modelos oficiales de MediaPipe se descargan con versión y hash verificados en `.smartstudio-data/models/`, fuera de Git. `SMARTSTUDIO_DATA_DIR` permite preparar y ejecutar la aplicación con otro directorio de datos. Si darktable no está instalado, el revelado conserva la ruta rawpy de respaldo; si falta un modelo, la aplicación omite las operaciones que dependan de él en vez de aplicar máscaras inciertas. El completado de fondo solo se activa cuando encuentra suficiente superficie uniforme en la propia fotografía y protege la silueta segmentada.

La interfaz queda disponible en `http://localhost:5173`. Los datos de desarrollo se guardan en `.smartstudio-data/`, fuera de Git. Para comprobar tipos y compilación usa `pnpm check`; para la prueba integral usa `pnpm test:e2e`.

La preparación y las comprobaciones pendientes de la Sony A7 IV están en [`docs/sony-a7iv-usb-validation.md`](docs/sony-a7iv-usb-validation.md). SmartStudio observa una carpeta local de Imaging Edge; esa integración no debe considerarse validada por USB hasta completar la lista física indicada allí.

## Principios iniciales

- Procesamiento y almacenamiento principalmente locales.
- Privacidad de las fotografías.
- Aprovechamiento de GPU cuando aporte valor.
- Preferencia por herramientas gratuitas o de código abierto.
- Procesamiento rápido y modular, sin depender de APIs pagadas.
- Las decisiones concretas se tomarán después de investigación y discusión, no desde este documento.

## Flujo de trabajo

1. `grill-me`
2. `to-spec`
3. `to-tickets`
4. `implement`
5. `code-review`

Al terminar `grill-me`, el contexto y las decisiones confirmadas se reflejan en `CONTEXT.md` o en un ADR solamente cuando aporten información estable antes de ejecutar `to-spec`.

El proyecto no adopta TDD como regla global. La implementación deberá verificarse después de cada incremento mediante las pruebas, comparaciones visuales, mediciones o comprobaciones de hardware que correspondan.

## Documentación

- `CONTEXT.md`: contexto estable y vocabulario del dominio.
- `docs/agents/`: configuración compartida por las Skills.
- `docs/sony-a7iv-usb-validation.md`: mecanismo USB elegido y validación física pendiente.
- `docs/editing-development-reference.md`: mediciones automatizadas de edición en esta computadora.
- `docs/codex-handoff.md`: estado y pasos para reanudar el proyecto en otra computadora con Codex.
- `docs/adr/`: decisiones arquitectónicas futuras, creadas solo cuando sean necesarias.
- `.scratch/`: especificaciones y tickets locales creados por las Skills cuando comience la definición del proyecto.

## Datos locales

Las fotografías, archivos RAW, modelos, exportaciones, cachés y secretos no deben incorporarse al repositorio. Los patrones principales están definidos en `.gitignore`.
