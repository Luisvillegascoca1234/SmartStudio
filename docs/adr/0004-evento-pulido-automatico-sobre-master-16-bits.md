# ADR 0004 — Evento pulido automático sobre máster de 16 bits

**Estado:** aceptada

## Decisión

Los trabajos nuevos usan un único perfil versionado, **Evento pulido**, sin selección de perfil, intensidad ni ajustes fotográficos del operador. darktable aplica una receta XMP ejecutable y versionada: fija exposición y enfoque mediante entradas reales de historial, conserva el flujo scene-referred y los presets integrados dependientes de cámara, y excluye los presets personales. La corrección óptica continúa en la etapa Lensfun cuando los metadatos permiten identificar la combinación cámara/lente. rawpy y el JPEG autorizado aplican una receta raster de respaldo cuyos parámetros forman parte del mismo manifiesto y hash. El retoque localizado se ejecuta sobre el máster TIFF sRGB con ICC incrustado; la vista previa y el JPEG completo se derivan de ese mismo resultado retocado.

MediaPipe y OpenCV continúan funcionando localmente, pero el retoque deja de estar limitado a una apariencia conservadora: debe producir una corrección visible de evento. La intensidad no puede cambiar identidad, geometría corporal o facial, tono natural de piel, iris, mirada ni rasgos permanentes. Cada operación localizada se omite de forma independiente cuando su máscara o confianza no cumple el límite obligatorio correspondiente.

El operador conserva comparación, ampliación, desplazamiento, aprobación, rechazo, revocación y reintento exclusivo de fallos técnicos. Los perfiles y parámetros históricos de Natural de evento permanecen legibles e inmutables.

## Motivo

El miniestudio necesita resultados terminados y perceptibles sin convertir la operación del evento en una sesión de revelado manual. Un único máster evita que vista previa y entrega diverjan, y los límites obligatorios permiten aumentar la intensidad sin autorizar cambios de identidad o geometría.

## Consecuencias

- La activación del perfil automático puede preceder a la receta XMP y al pipeline de 16 bits, que se implementan en incrementos posteriores de la misma iniciativa.
- Cada versión de receta debe quedar fijada en el trabajo para que un reintento técnico sea reproducible.
- El XMP de Evento pulido v1 contiene historial ejecutable; un manifiesto descriptivo con historial vacío no satisface esta decisión.
- La diferencia de la receta raster de respaldo respecto de darktable se conserva como advertencia visible y procedencia versionada.
- La omisión de una operación incierta no cancela correcciones independientes que sí sean seguras.
- Los originales RAW y JPEG siguen siendo inmutables y permanecen fuera de Git.
- Esta decisión sustituye en ADR 0002 la limitación de OpenCV a una intensidad conservadora, pero conserva darktable, MediaPipe y el funcionamiento local como base técnica.
- ADR 0003 sigue vigente y su completado determinista de fondo pasa a formar parte de Evento pulido.
