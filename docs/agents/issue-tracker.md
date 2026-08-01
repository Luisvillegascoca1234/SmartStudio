# Issue tracker: Markdown local

Las especificaciones y los tickets de este repositorio viven como archivos Markdown bajo `.scratch/`.

## Convenciones

- Una carpeta por iniciativa: `.scratch/<slug>/`.
- La especificación se guarda en `.scratch/<slug>/spec.md`.
- Cada ticket se guarda por separado en `.scratch/<slug>/issues/<NN>-<slug>.md`.
- Los tickets se numeran desde `01` en orden de dependencias.
- Cada ticket declara sus bloqueos y su estado cerca del inicio del archivo.
- El estado inicial de un ticket aprobado es `ready-for-agent`.

Cuando una Skill indique “publicar en el issue tracker”, debe crear o actualizar los archivos correspondientes bajo `.scratch/`. Estos archivos forman parte del historial del proyecto y no están excluidos por `.gitignore`.

Cuando una Skill necesite obtener un ticket, debe leer la ruta proporcionada por el usuario o localizar el número dentro de la iniciativa activa.
