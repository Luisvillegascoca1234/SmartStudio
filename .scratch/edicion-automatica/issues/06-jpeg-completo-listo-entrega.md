# 06 — Generar el JPEG completo listo para entrega

**What to build:** convertir una versión aprobada en un JPEG sRGB de resolución completa, validado y asociado con su original, para dejar una salida inequívoca preparada para los módulos posteriores.

**Blocked by:** 03 — Revelar Sony ARW/Canon CR2 y autorizar la alternativa JPEG; 05 — Gestionar versiones, reprocesamiento y aprobación.

**Status:** completed

- [x] La aprobación solicita un JPEG sRGB de resolución completa usando el mismo perfil y parámetros de la vista previa aprobada.
- [x] La vista previa y el resultado completo conservan una asociación inequívoca con la versión, captura, sesión fotográfica y evento.
- [x] El archivo completo se comprueba como legible y con dimensiones coherentes antes de declararse válido.
- [x] La copia preparada para entrega no contiene GPS ni número de serie de la cámara.
- [x] La información operativa necesaria para rastrear el resultado permanece guardada localmente.
- [x] Una sesión fotográfica solo muestra `Edición aprobada y lista para entrega` cuando existe una aprobación vigente y su JPEG completo superó las comprobaciones.
- [x] Un fallo durante la generación completa conserva la vista previa y la aprobación, muestra que la salida está pendiente o fallida y permite reintentar.
- [x] Revocar o reemplazar la aprobación actualiza cuál archivo completo está vigente sin borrar automáticamente versiones anteriores.
- [x] El RAW, el JPEG original y las demás versiones permanecen intactos.
- [x] Las verificaciones comprueban desde el flujo visible la generación, fallo, reintento, asociación, metadatos permitidos y estado listo para entrega.
