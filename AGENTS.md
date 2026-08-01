# Instrucciones del proyecto

## Alcance actual

El repositorio está en fase de preparación. No diseñar la arquitectura, inventar requisitos ni implementar funcionalidades hasta que el usuario inicie explícitamente las etapas correspondientes.

La aplicación futura será local y automatizará un flujo fotográfico para un miniestudio temporal en bodas y eventos. Las restricciones y términos confirmados están en `CONTEXT.md`.

## Flujo acordado

Seguir este orden:

1. `grill-me`
2. `grill-with-docs`
3. `to-spec`
4. `to-tickets`
5. `implement`
6. `code-review`

No incorporar TDD como metodología global. Implementar incrementos pequeños y verificar su comportamiento después de cada cambio. Elegir la verificación según el riesgo: pruebas automatizadas, integración, imágenes de referencia, inspección visual, mediciones de rendimiento o comprobaciones con hardware real.

No crear commits automáticamente. Solicitar autorización explícita del usuario antes de confirmar cambios.

## Límites

- Mantener las fotografías, RAW, modelos, resultados y secretos fuera de Git.
- Preferir soluciones locales, gratuitas o de código abierto cuando sean adecuadas.
- No seleccionar tecnologías o arquitectura de forma definitiva antes de la especificación.
- Leer solamente la documentación necesaria para la tarea activa.
- Evitar documentación y abstracciones preventivas.

## Convenciones de Git

- Rama estable: `main`.
- Ramas breves: `feat/`, `fix/`, `docs/` y `chore/`.
- Commits: Conventional Commits, limitados a categorías que aporten información.

## Agent skills

### Issue tracker

Las especificaciones y los tickets se almacenan localmente como Markdown bajo `.scratch/`. Ver `docs/agents/issue-tracker.md`.

### Domain docs

El repositorio usa un único contexto de dominio. Ver `docs/agents/domain.md`.

## Skills locales

Las Skills se encuentran en `.agents/skills/` y pertenecen solo a este proyecto. `grilling` y `domain-modeling` son dependencias internas de `grill-me` y `grill-with-docs`.

La copia local de `implement` está adaptada deliberadamente para no invocar TDD y para no crear commits sin autorización. Al actualizar las Skills, conservar o reaplicar esa adaptación.
