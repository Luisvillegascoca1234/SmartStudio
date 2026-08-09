# 11 — Demostrar la prueba de concepto Adobe

**What to build:** reunir evidencia suficiente de calidad, estabilidad, funcionamiento offline y rendimiento para comparar la alternativa Adobe con la versión local sin declararla operativa prematuramente.

**Blocked by:** 03, 05, 06, 07, 08, 09 y 10.

**Status:** implementation-complete-validation-pending

- [x] El recorrido integral usa Camera Raw, Photoshop, preset, Actions y Droplets reales en la computadora de desarrollo.
- [ ] La prueba offline demuestra el recorrido obligatorio sin Firefly ni conexión continua a internet.
- [ ] Fotografías controladas o autorizadas cubren una persona, grupos, tonos de piel diversos, ropa clara y oscura, cabello suelto, aretes, gafas y fondo uniforme.
- [ ] La revisión documenta calidad de Natural, Fondo y correcciones manuales sin incorporar las fotografías ni resultados a Git.
- [x] Los fallos representativos demuestran comprobación previa, timeout, reintento, reinicio, salida inválida, corrección manual y recuperación mediante darktable.
- [x] Nuevas sesiones fotográficas continúan mientras Adobe procesa o espera revisión.
- [x] Las mediciones separan tiempo total, tiempo hasta vista previa, memoria del coordinador, fallos, reintentos e intervención manual persistida.
- [ ] La computadora objetivo valida que al menos el 95 % de las vistas previas estén disponibles en 30 segundos o menos antes de considerar operativa la alternativa.
- [ ] La evidencia compara Adobe con la versión local mediante material equivalente y registra calidad, velocidad y estabilidad sin elegir silenciosamente una ganadora.
- [x] El resultado final identifica criterios aprobados, riesgos pendientes y si la alternativa puede avanzar a uso operativo.

## Evidencia y decisión

- `.scratch/edicion-automatica-adobe/validation-report.md` contiene equipo, recorrido real, mediciones, comparación técnica, pendientes y criterio de avance.
- `scripts/verify-real-adobe.ts` reproduce la integración real y guarda reporte/resultados fuera de Git.
- Integración real: 8,227 ms; JPEG sRGB 6000 × 4000; RAW inmutable; sin EXIF/XMP.
- Suite completa: typecheck y 42/42 pruebas E2E aprobadas en 4.4 minutos.
- QA de interfaz solicitado: recorrido RAW+JPEG completo con Adobe real, comparación, corrección manual preparada/cancelada, Fondo omitido de forma conservadora, aprobación y diseño 1440 × 900 / 390 × 844. Se registró un hallazgo UX moderado por exponer `ENOENT` al configurar una ruta de SSD inexistente.
- Decisión: prueba de concepto funcional; **no operativa todavía** por falta de lote autorizado, QA visual, prueba físicamente desconectada, pico total de memoria y percentil 95.
