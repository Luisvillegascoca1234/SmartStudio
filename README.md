# Local Photo Workflow

Repositorio de una futura aplicación local para automatizar el flujo de trabajo de un miniestudio fotográfico en bodas y eventos.

## Estado

El proyecto está en preparación. Todavía no se han definido la arquitectura ni los requisitos completos y no existe código de aplicación.

## Entorno de desarrollo

- Git con rama principal `main`.
- Node.js `24.18.0` LTS, seleccionado mediante `fnm` y `.node-version`.
- pnpm disponible mediante el entorno de Node/Corepack.
- Python y `uv` disponibles para una futura evaluación; todavía no forman parte de la arquitectura.
- Docker y CUDA no son requisitos del proyecto en esta etapa.

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
- `docs/adr/`: decisiones arquitectónicas futuras, creadas solo cuando sean necesarias.
- `.scratch/`: especificaciones y tickets locales creados por las Skills cuando comience la definición del proyecto.

## Datos locales

Las fotografías, archivos RAW, modelos, exportaciones, cachés y secretos no deben incorporarse al repositorio. Los patrones principales están definidos en `.gitignore`.
