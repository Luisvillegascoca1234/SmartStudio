import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { performanceReport } from "../src/server/performance-report.js"
import { WorkflowStore } from "../src/server/workflow-store.js"

const dataDirectory = path.resolve(process.env.SMARTSTUDIO_DATA_DIR ?? ".smartstudio-data")
const store = new WorkflowStore(dataDirectory)
await store.initialize()
const state = store.snapshot()
const report = performanceReport(state.editingJobs)
const destinationDirectory = path.join(dataDirectory, "validation")
await mkdir(destinationDirectory, { recursive: true })
const destination = path.join(destinationDirectory, "event-polished-performance.json")
await writeFile(destination, `${JSON.stringify(report, null, 2)}\n`, "utf8")
console.log(JSON.stringify({ destination, ...report }, null, 2))
