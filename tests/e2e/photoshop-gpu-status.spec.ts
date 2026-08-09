import { expect, test } from "@playwright/test"

import { parsePhotoshopGpuStatus } from "../../src/server/photoshop-gpu.js"

test("reconoce Photoshop con GPU activa y conserva la RTX informada", () => {
  expect(parsePhotoshopGpuStatus(JSON.stringify({
    available: true,
    enabled: true,
    device: "NVIDIA GeForce RTX 5050 Laptop GPU",
    error: null,
  }))).toEqual({
    available: true,
    enabled: true,
    device: "NVIDIA GeForce RTX 5050 Laptop GPU",
    error: null,
  })
})

test("cae de forma segura cuando el diagnóstico GPU no es válido", () => {
  expect(parsePhotoshopGpuStatus("salida inválida")).toMatchObject({
    available: false,
    enabled: false,
    device: null,
  })
})
