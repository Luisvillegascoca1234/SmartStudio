# 05 — Aplicar pulido visible de piel

**What to build:** aplicar automáticamente sobre el máster completo un pulido de piel claramente visible que reduzca irregularidades temporales y conserve textura, tono natural y rasgos permanentes.

**Blocked by:** 04 — Eliminar JPEG intermedios y derivar la preview del máster.

**Status:** completed

- [x] El análisis local identifica regiones de piel con una medida de confianza y traslada la máscara a la resolución del máster.
- [x] Evento pulido reduce de forma visible brillo, rojeces, ojeras e imperfecciones temporales detectadas con confianza.
- [x] La corrección uniforma tono y textura sin borrar poros, barba, cejas, cabello ni bordes faciales.
- [x] El tono natural de piel no cambia significativamente y las transiciones de la máscara no producen halos.
- [x] Lunares, cicatrices, tatuajes y otros rasgos permanentes no se eliminan automáticamente.
- [x] Una máscara de piel incierta omite el pulido de esa región, registra una advertencia y conserva las demás correcciones fotográficas.
- [x] Fixtures controlados demuestran una diferencia visible a tamaño normal y conservación de textura y regiones protegidas al ampliar.
- [x] El resultado continúa como máster sin pérdida y no introduce JPEG intermedios.
