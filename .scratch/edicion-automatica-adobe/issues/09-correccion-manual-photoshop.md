# 09 — Corregir manualmente una versión en Photoshop

**What to build:** ofrecer una recuperación controlada para máscaras, bordes o retoques defectuosos, conservando un PSD reversible y devolviendo la corrección a SmartStudio como una versión nueva que requiere revisión.

**Blocked by:** 06 — Recuperar fallos, demoras e interrupciones de Adobe; 07 — Versionar recursos Adobe e integrar ajustes acotados.

**Status:** completed

- [x] El operador puede marcar una versión Natural o Fondo como `Necesita revisión en Photoshop`.
- [x] SmartStudio abre o prepara únicamente la fotografía seleccionada para corrección y conserva los originales intactos.
- [x] La corrección manual utiliza un PSD asociado inequívocamente con el trabajo y la versión de origen.
- [x] Nuevos trabajos que necesitan Photoshop se pausan durante la corrección manual, mientras captura, selección y otras funciones continúan.
- [x] Guardar la corrección produce una versión de edición nueva y no sobrescribe la automática.
- [x] La versión corregida vuelve a revisión y nunca queda aprobada por el acto de guardar.
- [x] Finalizar o cancelar la corrección deja un estado comprensible y permite reanudar la cola Adobe.
- [x] Reiniciar durante una corrección conserva el PSD y recupera un estado seguro sin aceptar guardados parciales.
- [x] El seam controlado recorre apertura, pausa, guardado, versión nueva, revisión, reanudación y cancelación.

## Evidencia

- `tests/e2e/adobe-manual-correction.spec.ts` valida PSD real (`8BPS`), capa asociada, pausa/reanudación, reimportación, cancelación y reinicio.
- Los PSD se guardan en el directorio de datos local, fuera de Git, bajo trabajo y versión de origen.
- Verificación enfocada: typecheck y prueba E2E aprobados.
