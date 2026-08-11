# ADR 0003 — Completado determinista del fondo del miniestudio

**Estado:** sustituida parcialmente por ADR 0005

## Decisión

El perfil Evento pulido puede completar un fondo uniforme interrumpido por pared, bordes o soportes visibles. MediaPipe produce la máscara semántica; la aplicación protege la silueta de las personas y reconstruye fuera de ella un plano de color e iluminación calculado desde regiones limpias de la misma fotografía.

La operación se omite cuando la cobertura, uniformidad o separación de la persona no alcanzan umbrales conservadores. No usa relleno generativo, no incorpora otra escena y no funciona como eliminador general de objetos.

ADR 0005 conserva este completado como respaldo, pero sustituye la restricción de usar exclusivamente regiones de la misma fotografía cuando existe una placa limpia validada para el evento.

## Motivo

El miniestudio temporal puede dejar visible el límite físico del fondo aunque la iluminación y el color estén controlados. En ese caso existe suficiente información en la propia captura para continuar el fondo sin inventar contenido fotográfico.

## Consecuencias

- El resultado depende del modelo local de segmentación ya preparado para MediaPipe.
- Cabello, piel, ropa y un margen alrededor de la silueta quedan protegidos.
- La app conserva el original y muestra una advertencia si decide no aplicar la corrección.
- Fotografías con fondos complejos o no uniformes quedan fuera de esta capacidad.
