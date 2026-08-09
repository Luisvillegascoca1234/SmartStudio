# 08 — Crear SmartStudio-Fondo como versión explícita

**What to build:** permitir que el operador solicite después de revisar Natural una segunda versión Adobe destinada al fondo uniforme del miniestudio, sin aplicarla automáticamente ni sobrescribir el resultado anterior.

**Blocked by:** 05 — Conectar Camera Raw y Photoshop para SmartStudio-Natural; 07 — Versionar recursos Adobe e integrar ajustes acotados.

**Status:** completed

- [x] `SmartStudio-Fondo` solo está disponible después de que exista una versión Natural lista para revisar.
- [x] Solicitar Fondo es una acción explícita del operador y nunca una decisión silenciosa de SmartStudio.
- [x] La Action correspondiente aplica revelado y retoque conservador más la corrección destinada al fondo uniforme.
- [x] El resultado Fondo se registra como una versión nueva con motor, recursos, parámetros y origen propios.
- [x] La versión Natural permanece disponible para comparación, aprobación o recuperación.
- [x] Un resultado Fondo nunca hereda automáticamente la aprobación de Natural.
- [x] La interfaz permite revisar persona, cabello, accesorios y bordes antes de aprobar.
- [x] El seam controlado verifica solicitud, procesamiento, comparación, rechazo y aprobación de ambas versiones.
- [x] La calidad real del fondo y de la máscara queda reservada para fotografías controladas o autorizadas durante la validación correspondiente.

## Evidencia

- `tests/e2e/adobe-backdrop-version.spec.ts` cubre disponibilidad, solicitud explícita, comparación, rechazo y aprobación.
- El recurso `SmartStudio Fondo.jsx` y la instantánea de Action identifican la automatización; el motor real termina el completado conservador mediante segmentación local y omite cambios inciertos.
- Verificación enfocada: typecheck, build y 11 pruebas aprobadas.
