# 05 — Proteger el evento con verificación y respaldo

**What to build:** comprobar antes y durante el evento que existe capacidad operativa suficiente, respaldar el trabajo completo en un SSD externo y aplicar límites seguros sin perder la sesión fotográfica activa.

**Blocked by:** 04 — Añadir selección asistida por calidad.

**Status:** completed

- [x] La pantalla previa informa el estado de la fuente de captura, almacenamiento interno, SSD externo y alimentación eléctrica.
- [x] El operador distingue claramente espacio suficiente, bajo y crítico.
- [x] El espacio bajo genera una advertencia y permite continuar.
- [x] El espacio crítico sin SSD permite terminar la sesión fotográfica activa, pero bloquea el inicio de una nueva.
- [x] Un SSD disponible recibe en segundo plano todas las capturas y datos del evento.
- [x] Cada copia al SSD se verifica antes de mostrarse como respaldada.
- [x] Una desconexión o fallo del SSD genera una alerta visible y sonora sin borrar archivos ni detener indebidamente la sesión fotográfica activa.
- [x] El estado de respaldo se recupera después de reiniciar la aplicación.
- [x] La cámara y su tarjeta se presentan como copia original obligatoria, sin asumir que la transferencia reemplaza ese almacenamiento.
- [x] Las verificaciones cubren espacio suficiente, bajo y crítico, SSD correcto, SSD desconectado, copia fallida y recuperación.
