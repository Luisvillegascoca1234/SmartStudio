# 07 — Añadir detección facial y suavizado de piel

**What to build:** aplicar un suavizado de piel conservador a los rostros detectados en fotografías individuales o grupales, con niveles controlados y advertencias cuando el tratamiento no pueda realizarse con confianza.

**Blocked by:** 04 — Aplicar el perfil Natural de evento y ajustes manuales; 06 — Generar el JPEG completo listo para entrega.

**Status:** completed

- [x] La detección facial funciona localmente y no identifica ni registra la identidad de las personas.
- [x] Los niveles disponibles son `Desactivado`, `Suave` y `Medio`; `Suave` es el valor predeterminado.
- [x] El suavizado conserva textura natural y no altera facciones, cuerpo ni zonas fuera de los rostros detectados.
- [x] Todos los rostros detectados en una fotografía grupal reciben un tratamiento uniforme y conservador.
- [x] Un rostro que no pueda tratarse con confianza queda sin modificar y genera una advertencia para el operador.
- [x] La ausencia de rostros no convierte el trabajo en fallido ni aplica cambios arbitrarios.
- [x] Cambiar el nivel genera una versión nueva o actualiza únicamente la versión en revisión de forma no destructiva.
- [x] El efecto aparece de forma consistente en la vista previa y el JPEG completo aprobado.
- [x] La función continúa operativa sin internet y mantiene fotografías y modelos fuera de Git.
- [x] Las verificaciones utilizan material controlado con una persona, grupos y tonos de piel diversos; la inspección visual manual queda pendiente hasta autorización de QA.
