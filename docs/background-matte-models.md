# Modelos locales para matte de fondo

## Candidato BiRefNet General Lite

- Proveedor interno: `birefnet`.
- Arquitectura/checkpoint: BiRefNet General Lite, `general-bb_swin_v1_tiny`, época 232.
- Nombre local fijo: `birefnet-general-lite.onnx`.
- Origen del artefacto: release `v0.0.0` de `danielgatis/rembg`, el mismo artefacto referenciado por rembg 2.0.78.
- Código y arquitectura originales: `ZhengPeng7/BiRefNet`.
- Licencia declarada por el proyecto original: MIT.
- Tamaño esperado: 224005088 bytes.
- MD5 publicado por rembg: `4fab47adc4ff364be1713e97b7e66334`.
- SHA-256 fijado por SmartStudio: `5600024376f572a557870a5eb0afb1e5961636bef4e1e22132025467d0f03333`.
- Entrada: RGB normalizado con ImageNet, `1024 × 1024`, NCHW `float32`.
- Runtime fijado: ONNX Runtime GPU 1.28.0; orden de proveedores `CUDAExecutionProvider`, `CPUExecutionProvider`.

`pnpm setup:vision` instala las dependencias fijadas y descarga/verifica los modelos en `.smartstudio-data/models`, fuera de Git. La aplicación solo abre artefactos locales ya verificados: no descarga modelos al procesar una fotografía ni durante un evento.

La selección es técnica mediante `SMARTSTUDIO_MATTE_PROVIDER=birefnet`; no se expone al operador. Mientras el candidato esté en calibración, el valor predeterminado sigue siendo `mediapipe`. `SMARTSTUDIO_BIREFNET_FORCE_CPU=1` existe únicamente para diagnóstico e integración automatizada.

Referencias:

- https://github.com/ZhengPeng7/BiRefNet
- https://github.com/danielgatis/rembg/blob/v2.0.78/rembg/sessions/birefnet_general_lite.py
- https://onnxruntime.ai/docs/execution-providers/CUDA-ExecutionProvider.html
