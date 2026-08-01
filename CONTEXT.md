# Contexto del dominio

## Propósito

El proyecto busca automatizar localmente el flujo de trabajo de un miniestudio fotográfico instalado temporalmente en bodas y eventos.

Este documento contiene únicamente contexto confirmado. No constituye todavía una especificación funcional ni una selección de arquitectura.

## Flujo previsto

El contexto de trabajo contempla:

1. Conectar una cámara Sony A7 IV a una computadora.
2. Recibir automáticamente las fotografías tomadas.
3. Procesar archivos RAW localmente.
4. Aplicar una edición automática consistente.
5. Trabajar con iluminación y fondo estandarizados cuando estén disponibles.
6. Admitir fotografías tomadas en condiciones menos controladas.
7. Preparar imágenes para revisión, selección, entrega o impresión.
8. Reducir el tiempo requerido por fotografía.

Los detalles, excepciones y criterios de aceptación deberán resolverse mediante `grill-me` y `grill-with-docs` antes de convertirse en una especificación.

## Entorno objetivo conocido

- Laptop con Windows 11 Home de 64 bits.
- AMD Ryzen 5 240.
- 16 GB de RAM.
- NVIDIA GeForce RTX 5050 Laptop con 8 GB de VRAM.
- GPU integrada AMD Radeon 760M.
- Cámara Sony A7 IV.

La computadora de desarrollo secundaria utiliza Windows 10 Pro, Intel Core i7-10700K, 16 GB de RAM y NVIDIA GeForce RTX 3060 con 12 GB de VRAM. Sus resultados de rendimiento no representan necesariamente los de la laptop objetivo.

## Prioridades confirmadas

- Funcionamiento principalmente local.
- Privacidad de las fotografías.
- Procesamiento rápido.
- Uso de GPU cuando sea adecuado.
- Preferencia por herramientas gratuitas o de código abierto.
- Ausencia de dependencias obligatorias de APIs pagadas.
- Modularidad y posibilidad de evolución.
- Uso personal; no es una plataforma para múltiples clientes.

## Vocabulario inicial

- **Miniestudio:** instalación fotográfica temporal utilizada durante un evento.
- **Computadora objetivo:** laptop en la que operará principalmente la aplicación durante los eventos.
- **Computadora de desarrollo secundaria:** computadora actual utilizada para desarrollo y pruebas que no dependan del hardware final.
- **RAW:** archivo de imagen con los datos de captura sin el revelado final.
