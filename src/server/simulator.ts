import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import sharp from "sharp"
import type { QualityWarning } from "../shared/workflow.js"

export type SimulationProfile = QualityWarning | "backdrop"

const escapeXml = (value: string): string =>
  value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")

export async function prepareSimulatedPair(options: {
  dataDirectory: string
  baseName: string
  capturedAt: string
  profile?: SimulationProfile
}): Promise<{ rawPath: string; jpegPath: string }> {
  const inboxDirectory = path.join(options.dataDirectory, "simulator-inbox")
  await mkdir(inboxDirectory, { recursive: true })
  const rawPath = path.join(inboxDirectory, `${options.baseName}.ARW`)
  const jpegPath = path.join(inboxDirectory, `${options.baseName}.JPG`)

  await writeFile(
    rawPath,
    Buffer.concat([
      Buffer.from("SMARTSTUDIO_SIMULATED_RAW\0", "ascii"),
      Buffer.from(options.baseName, "utf8"),
      Buffer.from([0]),
      Buffer.from(options.capturedAt, "utf8"),
    ]),
  )

  const title = escapeXml(options.baseName)
  const timestamp = escapeXml(new Date(options.capturedAt).toLocaleString("es-BO"))
  const faceX = options.profile === "poor-framing" ? 10 : 930
  const closedEyes = options.profile === "eyes-closed"
  const overlay = Buffer.from(options.profile === "backdrop" ? `
    <svg width="1200" height="800" xmlns="http://www.w3.org/2000/svg">
      <rect width="1200" height="800" fill="#6f9ca8"/>
      <path d="M0 0H1200V220L0 310Z" fill="#777b80"/>
      <rect x="45" y="155" width="55" height="145" rx="15" fill="#111111"/>
      <rect x="1090" y="145" width="50" height="150" rx="15" fill="#111111"/>
      <ellipse cx="600" cy="465" rx="215" ry="305" fill="#b97852"/>
    </svg>` : `
    <svg width="1200" height="800" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#26383f"/>
          <stop offset="1" stop-color="#684d73"/>
        </linearGradient>
      </defs>
      <rect width="1200" height="800" fill="url(#g)"/>
      <circle cx="${faceX}" cy="240" r="180" fill="#efb27d"/>
      ${closedEyes
        ? `<path d="M ${faceX - 105} 220 h 70 M ${faceX + 35} 220 h 70" stroke="#211813" stroke-width="18" stroke-linecap="round"/>`
        : `<ellipse cx="${faceX - 70}" cy="220" rx="30" ry="20" fill="#fff"/><ellipse cx="${faceX + 70}" cy="220" rx="30" ry="20" fill="#fff"/><circle cx="${faceX - 70}" cy="220" r="9" fill="#211813"/><circle cx="${faceX + 70}" cy="220" r="9" fill="#211813"/>`}
      <path d="M ${faceX - 45} 310 Q ${faceX} 340 ${faceX + 45} 310" fill="none" stroke="#7b3f35" stroke-width="10" stroke-linecap="round"/>
      <rect x="70" y="560" width="1060" height="160" rx="28" fill="#11130f" opacity="0.78"/>
      <text x="120" y="630" fill="#fff8eb" font-family="Arial" font-size="48" font-weight="700">${title}</text>
      <text x="120" y="682" fill="#e8dbc7" font-family="Arial" font-size="25">Captura simulada · ${timestamp}</text>
    </svg>`)

  let image = sharp(overlay)
  if (options.profile === "blur") image = image.blur(10)
  if (options.profile === "motion") {
    const kernel = Array(15 * 15).fill(0)
    for (let x = 0; x < 15; x += 1) kernel[7 * 15 + x] = 1 / 15
    image = image.convolve({ width: 15, height: 15, kernel })
  }
  if (options.profile === "exposure") image = image.linear(0.15)
  await image.jpeg({ quality: 88 }).toFile(jpegPath)
  return { rawPath, jpegPath }
}
