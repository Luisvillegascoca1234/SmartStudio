import { expect, test } from "@playwright/test"

import { runLocalProcess } from "../../src/server/local-process.js"

const nodeProcess = (source: string, options: Parameters<typeof runLocalProcess>[2]) =>
  runLocalProcess(process.execPath, ["-e", source], options)

const processExists = (pid: number): boolean => {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

test("supervisa finalización, fallo y salida acotada sin registrar argumentos privados", async () => {
  const diagnostics: Array<Parameters<NonNullable<Parameters<typeof runLocalProcess>[2]["onDiagnostic"]>>[0]> = []
  const completed = await nodeProcess("process.stdout.write('ok')", {
    stage: "controlled-success",
    timeoutMilliseconds: 2_000,
    onDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
  })
  expect(completed).toMatchObject({ code: 0, stdout: "ok", termination: "completed", stage: "controlled-success" })

  const failed = await nodeProcess("process.stderr.write('controlled failure'); process.exit(7)", {
    stage: "controlled-failure",
    timeoutMilliseconds: 2_000,
  })
  expect(failed).toMatchObject({ code: 7, termination: "failed" })

  const bounded = await nodeProcess("process.stdout.write('x'.repeat(4096))", {
    stage: "bounded-output",
    timeoutMilliseconds: 2_000,
    maximumOutputBytes: 128,
  })
  expect(Buffer.byteLength(bounded.stdout)).toBe(128)
  expect(bounded.outputTruncated).toBe(true)
  expect(diagnostics).toHaveLength(1)
  expect(diagnostics[0]).not.toHaveProperty("arguments")
})

test("termina por timeout un árbol bloqueado y permite ejecutar el siguiente proceso", async () => {
  const source = "const {spawn}=require('node:child_process'); const child=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'}); console.log(child.pid); setInterval(()=>{},1000)"
  const timedOut = await nodeProcess(source, { stage: "controlled-timeout", timeoutMilliseconds: 300 })
  expect(timedOut.termination).toBe("timeout")
  const childPid = Number.parseInt(timedOut.stdout.trim(), 10)
  await expect.poll(() => processExists(childPid), { timeout: 5_000 }).toBe(false)

  const following = await nodeProcess("process.stdout.write('next')", { stage: "after-timeout", timeoutMilliseconds: 2_000 })
  expect(following).toMatchObject({ code: 0, stdout: "next", termination: "completed" })
})

test("la cancelación efectiva termina un proceso que no coopera", async () => {
  const controller = new AbortController()
  const pending = nodeProcess("setInterval(()=>{},1000)", {
    stage: "controlled-cancellation",
    timeoutMilliseconds: 10_000,
    signal: controller.signal,
  })
  setTimeout(() => controller.abort(), 150)
  const cancelled = await pending
  expect(cancelled.termination).toBe("cancelled")
  expect(cancelled.durationMilliseconds).toBeLessThan(5_000)
})
