# ADR 0005 — Reemplazo determinista del fondo mediante placa limpia

**Estado:** aceptada

## Decisión

Evento pulido puede normalizar o reemplazar automáticamente el fondo del miniestudio mediante una placa limpia capturada, validada y asociada con el evento. La placa no es una escena arbitraria ni contenido generativo: representa el mismo fondo preparado para el evento sin personas.

La separación entre personas y fondo se obtiene mediante un matte alfa suave con regiones de persona segura, borde incierto y fondo seguro. La aplicación puede comparar proveedores locales de segmentación, pero solo promoverá uno después de validar calidad de bordes, licencia, procedencia y rendimiento en la computadora objetivo. El compositor opera con precisión flotante sobre el máster y conserva una salida efectiva de 16 bits.

La decisión por fotografía es automática. Si la placa y el matte son confiables, se reemplaza el fondo. Si no existe una placa válida pero el fondo uniforme puede reconstruirse con confianza desde la misma fotografía, se conserva el completado definido por ADR 0003. Si ninguna ruta es segura, se omite la operación y se conserva el fondo original.

No se ofrecen ajustes, máscaras, intensidad ni selección de fondos por fotografía. No se autoriza eliminación general de objetos, incorporación de otra escena, cambio de geometría, reencuadre ni relleno generativo.

## Motivo

El completado basado únicamente en regiones limpias de cada fotografía falla de forma segura cuando el fondo presenta variaciones, tiene poca cobertura visible o no permite distinguir una interrupción. En un miniestudio controlado existe una referencia más estable: una fotografía del fondo preparado antes de recibir a los invitados. Usarla permite obtener continuidad consistente sin inventar contenido y sin exigir edición manual durante el evento.

Un matte suave y un compositor de precisión completa son necesarios para proteger cabello, velos, encaje, transparencias, manos, flores y grupos, y para evitar halos o banding en fondos lisos.

## Consecuencias

- La preparación del evento incorpora la captura y validación de una placa limpia; no añade ajustes por fotografía.
- La placa, los modelos, las fotografías y los resultados permanecen fuera de Git.
- Cada resultado registra el hash de la placa, proveedor y versión del matte, confianza, ruta de procesamiento y decisión aplicada.
- La operación funciona localmente, prioriza GPU cuando esté disponible y conserva una ruta CPU.
- La sesión del modelo se reutiliza para evitar pagar el coste de carga en cada fotografía.
- MediaPipe puede permanecer como proveedor base o respaldo. Un proveedor ONNX especializado solo se activa después de una comparación visual y de rendimiento.
- ADR 0003 continúa vigente como respaldo cuando no existe una placa limpia válida.
- La aprobación editorial del resultado permanece en manos del operador, aunque el fondo no tenga controles configurables.
