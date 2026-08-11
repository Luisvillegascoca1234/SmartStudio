# 06 — Mejorar automáticamente ojos y dientes

**What to build:** añadir al máster ya pulido mejoras automáticas y visibles de ojos y dientes que mantengan geometría, iris, mirada, labios y encías.

**Blocked by:** 05 — Aplicar pulido visible de piel.

**Status:** completed

- [x] El motor detecta por rostro ojos, iris, boca y dientes con confianza independiente por región.
- [x] Los ojos rojos se corrigen únicamente dentro de regiones oculares confiables.
- [x] La parte blanca de los ojos recibe un aclarado controlado y los ojos aumentan moderadamente brillo, contraste y definición.
- [x] El color del iris, la dirección de la mirada y el tamaño y forma de los ojos permanecen sin cambios.
- [x] Los dientes visibles reducen dominante amarilla y aumentan luminosidad sin alcanzar blanco puro ni tonos grises o azules.
- [x] Labios y encías quedan protegidos y dientes no visibles o inciertos no se inventan ni retocan.
- [x] Una operación omitida genera una advertencia específica y no impide aplicar otras regiones seguras del mismo rostro.
- [x] Casos controlados con ojos rojos, gafas, ojos parcialmente visibles, dientes visibles y dientes ausentes demuestran el comportamiento externo.
- [x] El resultado permanece sin pérdida hasta producir una salida solicitada.
