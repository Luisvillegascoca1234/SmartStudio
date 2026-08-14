# 01 — Registrar y validar la placa limpia del evento

**What to build:** permitir que el operador incorpore durante la preparación una placa limpia del fondo del miniestudio, validarla y asociarla de forma inmutable con el evento para que pueda utilizarse posteriormente sin ajustes por fotografía.

**Blocked by:** None — can start immediately.

**Status:** completed

- [x] El operador puede incorporar una placa limpia durante la preparación del evento sin entrar en el flujo de edición de una fotografía.
- [x] La aplicación rechaza archivos ilegibles, incompletos, sin dimensiones utilizables o con personas detectadas.
- [x] La placa válida queda asociada exclusivamente con el evento y conserva identificador, hash, dimensiones, orientación, fecha y estado de validación.
- [x] Cambiar físicamente el montaje permite registrar una placa nueva sin alterar la referencia histórica de resultados anteriores.
- [x] La placa original permanece inmutable y fuera de Git.
- [x] Un evento sin placa válida continúa operativo y comunica que el fondo usará una ruta de respaldo.
- [x] Un recorrido automatizado comprueba registro, rechazo, sustitución versionada, persistencia después de reiniciar y aislamiento entre eventos.
