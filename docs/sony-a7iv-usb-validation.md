# Sony A7 IV por USB — mecanismo y validación pendiente

## Mecanismo local elegido

La primera integración usa **Imaging Edge Desktop (Remote)** como puente USB soportado por Sony. Remote guarda automáticamente cada captura en una carpeta local; SmartStudio observa esa carpeta, espera que cada archivo deje de cambiar y después incorpora RAW y JPEG al mismo flujo usado por la importación manual.

SmartStudio no controla la cámara ni implementa un protocolo USB propietario. Esta separación permite conservar el flujo local y disponer de la importación manual si Remote o el cable fallan.

Fuentes oficiales:

- [Sony A7 IV: modo de conexión USB](https://helpguide.sony.net/ilc/2110/v1/en/contents/TP1000616544.html)
- [Sony A7 IV: ajustes de captura remota](https://helpguide.sony.net/ilc/2110/v1/en/contents/TP1000659438.html)
- [Sony A7 IV: formato RAW](https://helpguide.sony.net/ilc/2110/v1/en/contents/TP1000659395.html)
- [Imaging Edge Desktop: captura remota](https://support.d-imaging.sony.co.jp/app/imagingedge/en/instruction/4_5_remote.php)

## Configuración que debe verificarse en la cámara

1. `Image File Format`: **RAW & JPEG**.
2. `RAW File Type`: **Lossless Comp (L)**.
3. `USB Connection Mode`: **Remote Shooting**.
4. `Still Img. Save Dest.`: **Dest.+Camera**.
5. `Save Image Size`: **Original**.
6. `RAW+J Save Image`: **RAW & JPEG**.
7. Tarjeta insertada, con espacio y grabación confirmada en la cámara.
8. En Imaging Edge Remote, `Save in` apunta a la misma carpeta configurada en la verificación previa de SmartStudio.

## Validación física obligatoria

Estas comprobaciones siguen pendientes y deben realizarse en la laptop Windows 11 objetivo, no en la computadora secundaria:

- [ ] Imaging Edge Remote reconoce la Sony A7 IV por USB de forma estable.
- [ ] El disparador físico de la cámara produce un RAW `.ARW` y un JPEG en la carpeta `Save in`.
- [ ] La misma captura permanece en la tarjeta de la cámara.
- [ ] SmartStudio muestra primero el componente que llegue y asocia después el par por nombre base.
- [ ] El JPEG real aparece como vista previa y el RAW queda marcado como asociado.
- [ ] Determinar con hardware real cómo detectar que se desconectó el cable o se cerró Remote y mostrar una advertencia sin cancelar la sesión.
- [ ] La importación manual recupera el par desde una carpeta después de la desconexión.
- [ ] El par real llega también al SSD y supera la verificación SHA-256.
- [ ] Se registran tiempos de llegada de JPEG y RAW y cualquier restricción observada.

## Limitaciones conocidas antes de la prueba física

- La carpeta solo incorpora archivos nuevos posteriores a su configuración; los archivos existentes se toman como línea base para evitar mezclar sesiones.
- Un archivo debe conservar el mismo tamaño y fecha de modificación durante dos comprobaciones consecutivas antes de incorporarse.
- El emparejamiento depende de que RAW y JPEG compartan el mismo nombre base.
- Imaging Edge Desktop es gratuito pero no es software de código abierto.
- La disponibilidad de la carpeta local no demuestra que la cámara o Remote sigan conectados. La versión actual detecta la pérdida de esa carpeta, pero no afirma detectar una desconexión USB; ese mecanismo queda bloqueado hasta la prueba física.
- La operación con disparador físico, el orden real de llegada, los tiempos y la recuperación de Remote todavía no están comprobados con el hardware objetivo.
