# 08 — Integrar el completado de fondo con el máster

**What to build:** aplicar el completado determinista del fondo uniforme dentro del pipeline sin pérdidas de Evento pulido, protegiendo personas y omitiendo la corrección cuando el fondo o la máscara no sean confiables.

**Blocked by:** 07 — Equilibrar iluminación facial y fotografías grupales.

**Status:** completed

- [x] El completado usa únicamente regiones limpias de la misma fotografía para estimar color e iluminación del fondo.
- [x] Pared, bordes o soportes visibles pueden sustituirse por la continuación determinista del fondo uniforme.
- [x] Cabello, piel, ropa, silueta y un margen seguro alrededor de las personas quedan protegidos.
- [x] La corrección opera sobre el pipeline sin pérdidas y no crea JPEG intermedios.
- [x] Un fondo complejo, no uniforme o sin cobertura suficiente queda sin cambios y genera una advertencia.
- [x] Una máscara de persona incierta omite la operación sin bloquear piel, ojos, dientes o iluminación facial seguros.
- [x] La función no elimina objetos en general, no incorpora otra escena y no usa relleno generativo.
- [x] Verificaciones controladas cubren fondo completado, fondo no uniforme, máscara incierta y conservación de píxeles protegidos.
