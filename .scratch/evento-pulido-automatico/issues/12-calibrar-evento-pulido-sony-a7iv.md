# 12 — Calibrar y fijar Evento pulido v1 con Sony A7 IV

**What to build:** validar y fijar la primera receta Evento pulido con RAW reales autorizados de la Sony A7 IV y referencias aprobadas, demostrando una corrección visible, consistente y fiel antes de optimizar rendimiento.

**Blocked by:** 11 — Alinear rawpy y JPEG de emergencia con Evento pulido.

**Status:** blocked-external-validation

- [ ] El conjunto externo autorizado cubre exposición correcta y moderadamente incorrecta, diferentes ISO, tonos y texturas de piel, ropa clara y oscura, gafas, barba, maquillaje, una persona, parejas y grupos.
- [ ] También cubre ojos rojos o parcialmente visibles, dientes visibles y no visibles y fondos completos, interrumpidos y no uniformes.
- [ ] Cada caso se compara con una referencia visual aprobada sin incorporar fotografías, RAW, modelos o resultados a Git.
- [ ] La corrección se aprecia a tamaño normal y conserva textura suficiente al 100 %.
- [ ] Las fotografías aprobadas evitan piel plástica, halos, banding, blancos sin detalle, sombras empastadas y apariencia HDR.
- [ ] Ojos, dientes, tono de piel, rasgos permanentes, geometría y grupos cumplen los límites obligatorios.
- [ ] Las decisiones de receta, módulos y parámetros quedan fijadas como Evento pulido v1 y no cambian retroactivamente.
- [ ] La comparación darktable/rawpy documenta la diferencia visual y determina si el respaldo necesita una advertencia adicional antes de aprobación.
- [x] Los ADR de darktable, MediaPipe, procesamiento de 16 bits y completado de fondo se actualizan o sustituyen para reflejar las decisiones arquitectónicas efectivamente confirmadas.
- [x] La validación de Canon y condiciones Sony menos controladas permanece separada y no se presenta como cerrada por esta calibración.

**Bloqueo externo:** falta el conjunto autorizado que cubra todos los casos anteriores y la aprobación visual humana a tamaño normal y 100 %. `pnpm calibrate:event-polished` valida y registra esa evidencia fuera de Git sin permitir cerrar criterios ausentes.
