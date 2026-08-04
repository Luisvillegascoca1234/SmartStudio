# 11 — Completar conservadoramente el fondo uniforme del miniestudio

**What to build:** reconstruir localmente las interrupciones de un fondo uniforme del miniestudio usando sus regiones limpias, sin modificar personas ni recurrir a edición generativa.

**Blocked by:** 07 — Añadir detección facial y suavizado de piel; 08 — Añadir mejoras suaves de ojos y dientes.

**Status:** completed

- [x] La operación usa segmentación local para proteger piel, cabello, ropa y silueta.
- [x] El color y la iluminación del fondo se estiman únicamente desde regiones limpias de la misma fotografía.
- [x] Pared, bordes y soportes visibles fuera de la persona pueden sustituirse por la continuación determinista del fondo uniforme.
- [x] La transición conserva un borde suavizado y no crea una escena ni textura mediante IA generativa.
- [x] Una máscara incierta o un fondo sin uniformidad suficiente omite la corrección y genera una advertencia.
- [x] El mismo comportamiento se aplica a la vista previa y al JPEG completo.
- [x] Una verificación controlada demuestra que el fondo cambia y la persona protegida conserva sus píxeles.
- [x] La fotografía y los modelos permanecen fuera de Git, y el operador conserva la comparación antes/después y la aprobación final.
