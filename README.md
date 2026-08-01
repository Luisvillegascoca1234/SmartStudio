# Local Photo Workflow

Repositorio de una futura aplicación local para automatizar el flujo de trabajo de un miniestudio fotográfico en bodas y eventos.

## Estado

Está en desarrollo el primer módulo: evento, captura y selección. Ya permite el flujo local con capturas simuladas o importadas, advertencias de calidad, respaldo verificado y recepción automática desde la carpeta de Imaging Edge Remote. La transferencia con una Sony A7 IV todavía requiere validación física en la laptop objetivo; no incluye edición, QR, impresión ni mensajes desde iPad.

## Entorno de desarrollo

- Git con rama principal `main`.
- Node.js `24.18.0` LTS, seleccionado mediante `fnm` y `.node-version`.
- pnpm disponible mediante el entorno de Node/Corepack.
- Python y `uv` disponibles para una futura evaluación; todavía no forman parte de la arquitectura.
- Docker y CUDA no son requisitos del proyecto en esta etapa.

La interfaz usa React, Tailwind CSS 4 y componentes shadcn/ui almacenados localmente en `src/components/ui/`. La configuración se conserva en `components.json`; agregar un componente no introduce una dependencia de servicios en línea durante la ejecución.

## Ejecutar el módulo local

```powershell
pnpm install
pnpm dev
```

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
- `docs/adr/`: decisiones arquitectónicas futuras, creadas solo cuando sean necesarias.
- `.scratch/`: especificaciones y tickets locales creados por las Skills cuando comience la definición del proyecto.

## Datos locales

Las fotografías, archivos RAW, modelos, exportaciones, cachés y secretos no deben incorporarse al repositorio. Los patrones principales están definidos en `.gitignore`.
