# 08 — Endurecer fallbacks, persistencia y procedencia

**What to build:** hacer que todas las decisiones y fallos posibles del fondo automático sean recuperables, explicables y reproducibles después de reiniciar, sin alterar resultados históricos ni requerir ajustes del operador.

**Blocked by:** 05 — Reemplazar automáticamente mediante la placa limpia; 07 — Añadir BiRefNet como proveedor ONNX candidato.

**Status:** completed

- [x] Placa ausente, corrupta, incompatible, perteneciente a otro evento o sustituida después de una versión se manejan sin ambigüedad.
- [x] Modelo ausente, checkpoint inválido, CUDA no disponible, fallo CPU y cierre del trabajador producen fallbacks o errores técnicos explícitos.
- [x] Una operación de fondo omitida no bloquea otras correcciones seguras de Evento pulido.
- [x] Un reintento técnico usa la placa, proveedor, modelo y parámetros fijados para la versión cuando continúan disponibles.
- [x] Cada versión conserva decisión, motivo, hash de placa, proveedor, versión, huella del modelo, confianza, ruta, tiempos y advertencias.
- [x] Trabajos y versiones históricos conservan su semántica y no se reinterpretan como resultados del nuevo motor.
- [x] Ningún fallo publica mattes, temporales o másteres parciales como versiones válidas.
- [x] Pruebas de reinicio, migración, reintento y cambio de placa demuestran asociación e inmutabilidad.
