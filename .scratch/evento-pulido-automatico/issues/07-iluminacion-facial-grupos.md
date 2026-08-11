# 07 — Equilibrar iluminación facial y fotografías grupales

**What to build:** equilibrar automáticamente sombras y brillos de los rostros y mantener una intensidad de retoque coherente entre las personas confiables de una fotografía grupal.

**Blocked by:** 06 — Mejorar automáticamente ojos y dientes.

**Status:** completed

- [x] El motor identifica por rostro sombras profundas y brillos especulares que pueden corregirse con confianza.
- [x] Evento pulido atenúa sombras faciales y controla brillos sin aplanar completamente el volumen natural del rostro.
- [x] Los rostros reciben un realce local moderado sin modificar la exposición global de forma contradictoria.
- [x] Una fotografía grupal aplica un objetivo visual consistente a todas las personas confiables y evita diferencias evidentes de intensidad de retoque.
- [x] Nariz, mandíbula, labios, facciones, rostro y cuerpo conservan su geometría.
- [x] La corrección no rejuvenece, envejece ni aplica maquillaje generativo.
- [x] Rostros parcialmente ocultos reciben solo operaciones seguras y registran las omisiones correspondientes.
- [x] Fixtures de una persona y grupos demuestran equilibrio visual, conservación de geometría y ausencia de halos.
