import { spawn } from "node:child_process"

export type LocalProcessResult = { code: number | null; stdout: string; stderr: string }

export const runLocalProcess = (executable: string, arguments_: string[]): Promise<LocalProcessResult> =>
  new Promise((resolve, reject) => {
    const child = spawn(executable, arguments_, { windowsHide: true })
    let stdout = ""
    let stderr = ""
    child.stdout.setEncoding("utf8")
    child.stderr.setEncoding("utf8")
    child.stdout.on("data", (chunk: string) => { stdout += chunk })
    child.stderr.on("data", (chunk: string) => { stderr += chunk })
    child.once("error", reject)
    child.once("close", (code) => resolve({ code, stdout, stderr }))
  })
