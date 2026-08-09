import { spawn } from "node:child_process"

export type LocalProcessResult = { code: number | null; stdout: string; stderr: string }

export const runLocalProcess = (
  executable: string,
  arguments_: string[],
  timeoutMilliseconds?: number,
  signal?: AbortSignal,
): Promise<LocalProcessResult> =>
  new Promise((resolve, reject) => {
    const child = spawn(executable, arguments_, { windowsHide: true })
    const timeout = timeoutMilliseconds
      ? setTimeout(() => {
          child.kill()
          reject(new Error(`El proceso local excedió ${timeoutMilliseconds} ms.`))
        }, timeoutMilliseconds)
      : null
    const abort = () => {
      child.kill()
      reject(new Error("El proceso local fue cancelado."))
    }
    signal?.addEventListener("abort", abort, { once: true })
    let stdout = ""
    let stderr = ""
    child.stdout.setEncoding("utf8")
    child.stderr.setEncoding("utf8")
    child.stdout.on("data", (chunk: string) => { stdout += chunk })
    child.stderr.on("data", (chunk: string) => { stderr += chunk })
    child.once("error", (error) => {
      if (timeout) clearTimeout(timeout)
      signal?.removeEventListener("abort", abort)
      reject(error)
    })
    child.once("close", (code) => {
      if (timeout) clearTimeout(timeout)
      signal?.removeEventListener("abort", abort)
      resolve({ code, stdout, stderr })
    })
  })
