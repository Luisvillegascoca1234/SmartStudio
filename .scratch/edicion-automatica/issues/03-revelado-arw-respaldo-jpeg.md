# 03 — Revelar Sony ARW/Canon CR2 y autorizar la alternativa JPEG

**What to build:** procesar localmente el Sony ARW o Canon CR2 de una fotografía principal y ofrecer un camino explícito desde JPEG cuando el RAW falte, esté corrupto o no sea compatible, manteniendo visible el origen del resultado.

**Blocked by:** 01 — Mostrar la primera edición automática de la fotografía principal.

**Status:** completed

- [x] Antes de comprometer una herramienta se investiga una ruta local adecuada para revelar Sony ARW en Windows, priorizando opciones gratuitas o de código abierto.
- [x] Un RAW válido produce una vista previa editable sin depender de internet ni de una API pagada.
- [x] El procesamiento conserva la asociación con el RAW y el JPEG originales de la captura.
- [x] Un RAW ausente, corrupto o incompatible produce un estado y una explicación comprensibles.
- [x] La app no procesa desde JPEG silenciosamente; requiere autorización explícita del operador.
- [x] Una versión producida desde JPEG permanece identificada como `Procesada desde JPEG` durante revisión y aprobación.
- [x] Rechazar el procesamiento desde JPEG conserva el trabajo y los originales sin fabricar un resultado.
- [x] La ruta básica funciona mediante CPU para que la ausencia de aceleración no elimine la capacidad.
- [x] Ambos orígenes producen versiones derivadas sin modificar los archivos originales.
- [x] Las verificaciones cubren ARW válido, RAW pendiente, RAW corrupto, incompatibilidad, autorización JPEG y rechazo de la autorización.
- [x] La importación reconoce CR2 y lo envía por la misma ruta local; la validación con un CR2 real queda pendiente hasta disponer del archivo de cámara.
