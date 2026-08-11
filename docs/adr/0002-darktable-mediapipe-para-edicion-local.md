# ADR 0002 — darktable y MediaPipe para la edición local

**Estado:** sustituida parcialmente por ADR 0004

## Decisión

El revelado RAW principal usa `darktable-cli` con el flujo scene-referred predeterminado y exporta un TIFF sRGB intermedio de 16 bits. rawpy/LibRaw permanece como respaldo cuando darktable no está disponible.

La detección de rostros, landmarks, parpadeo y regiones de piel usa modelos oficiales de MediaPipe almacenados localmente. OpenCV queda limitado a transformaciones conservadoras sobre máscaras calculadas por esos modelos y a las capturas sintéticas controladas de las pruebas.

ADR 0004 conserva la elección local de darktable, MediaPipe y OpenCV, pero sustituye la limitación de intensidad conservadora y concreta el pipeline objetivo de Evento pulido.

## Motivo

La validación con un Canon CR2 real mostró que la ruta anterior convertía pronto a sRGB de 8 bits y aplicaba ajustes globales simples. Los clasificadores Haar y las máscaras por umbrales de color omitieron ojos visibles y produjeron advertencias falsas de ojos cerrados, desenfoque y encuadre.

darktable ofrece una canalización fotográfica más completa y automatizable desde consola. MediaPipe aporta landmarks y segmentación semántica local sin identificar personas ni depender de una API remota.

## Consecuencias

- La computadora objetivo necesita darktable 5.6+; la ausencia del ejecutable no elimina la ruta rawpy de respaldo.
- Los modelos de MediaPipe se descargan durante la preparación y permanecen bajo `.smartstudio-data/models/`, fuera de Git.
- El procesamiento sigue funcionando sin internet después de la instalación.
- La edición omite regiones inciertas y conserva la decisión final del operador.
- La aceleración OpenCL de darktable se valida por separado en cada computadora.

## Relación con decisiones anteriores

Este ADR reemplaza a ADR 0001 como ruta RAW principal. ADR 0001 continúa describiendo el respaldo rawpy/LibRaw.
