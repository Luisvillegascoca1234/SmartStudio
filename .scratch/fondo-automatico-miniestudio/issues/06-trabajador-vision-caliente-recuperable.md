# 06 — Mantener un trabajador de visión caliente y recuperable

**What to build:** conservar cargados los modelos y sesiones de matte entre fotografías mediante un trabajador local supervisado, reduciendo el coste de inicio sin comprometer cancelación, recuperación ni aislamiento de resultados.

**Blocked by:** 02 — Encapsular la segmentación mediante MatteProvider.

**Status:** completed

- [x] El trabajador carga cada modelo una vez y ejecuta warm-up antes de atender trabajos normales.
- [x] Fotografías consecutivas reutilizan la sesión y registran por separado warm-up, inferencia, refinamiento y composición.
- [x] La cola continúa procesando una fotografía a la vez y no bloquea nuevas sesiones fotográficas.
- [x] Cancelación y timeout terminan el trabajo activo sin dejar procesos o archivos parciales válidos.
- [x] Un cierre inesperado del trabajador queda diagnosticado y permite reiniciarlo para el siguiente trabajo o reintento técnico.
- [x] Un reinicio de la aplicación recupera estados persistidos sin considerar válida una respuesta incompleta del trabajador anterior.
- [x] El protocolo entre aplicación y trabajador usa datos estructurados y versionados, no comandos textuales frágiles.
- [x] Una prueba de dos trabajos demuestra reutilización de sesión y una prueba de fallo demuestra recuperación operativa.
