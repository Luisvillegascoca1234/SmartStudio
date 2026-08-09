import { createHash } from "node:crypto"
import { readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import sharp from "sharp"

import { PhotoshopDropletEngine } from "../src/server/photoshop-droplet-engine.js"
import { naturalEventProfile, smartStudioAdobeResources, type Capture, type EditingJob } from "../src/shared/workflow.js"

const dataDirectory = path.resolve(process.env.SMARTSTUDIO_DATA_DIR ?? ".smartstudio-data")
const rawRelativePath = path.join("integration-test", "public-raw", "DSC01542.ARW")
const jpegRelativePath = path.join("integration-test", "public-raw", "DSC01542.jpg")
const outputRelativePath = path.join("integration-test", "public-raw", "DSC01542-engine-ticket11.jpg")
const outputPath = path.join(dataDirectory, outputRelativePath)
const digest = async (filePath: string): Promise<string> => createHash("sha256").update(await readFile(filePath)).digest("hex")

const profile = naturalEventProfile()
const capture = {
  id: "real-public-raw-capture",
  baseName: "DSC01542",
  rawRelativePath,
  jpegRelativePath,
} as Capture
const job = {
  id: "real-adobe-ticket11",
  eventId: "real-public-event",
  sessionId: "real-public-session",
  captureId: capture.id,
  engine: "adobe",
  automation: "natural",
  profile,
  adobeResources: smartStudioAdobeResources(),
  adjustments: profile.defaults,
  versions: [],
} as EditingJob

const rawPath = path.join(dataDirectory, rawRelativePath)
const rawBefore = await digest(rawPath)
const startedAt = Date.now()
const memoryBefore = process.memoryUsage().rss
await new PhotoshopDropletEngine(dataDirectory).render(job, capture, outputPath, "raw", false)
const elapsedMilliseconds = Date.now() - startedAt
const memoryAfter = process.memoryUsage().rss
const metadata = await sharp(outputPath).metadata()
const report = {
  checkedAt: new Date().toISOString(),
  input: rawRelativePath,
  output: outputRelativePath,
  rawSha256Before: rawBefore,
  rawSha256After: await digest(rawPath),
  outputSha256: await digest(outputPath),
  elapsedMilliseconds,
  nodeRssBeforeBytes: memoryBefore,
  nodeRssAfterBytes: memoryAfter,
  outputMetadata: {
    format: metadata.format,
    space: metadata.space,
    width: metadata.width,
    height: metadata.height,
    hasExif: Boolean(metadata.exif),
    hasXmp: Boolean(metadata.xmp),
  },
  resources: job.adobeResources,
  fireflyUsed: false,
  lightroomUsed: false,
}
await writeFile(path.join(dataDirectory, "integration-test", "real-adobe-ticket11-report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8")
console.log(JSON.stringify(report, null, 2))
