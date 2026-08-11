import { createHash } from "node:crypto"
import { mkdir, rename, rm, writeFile } from "node:fs/promises"
import path from "node:path"

export const EVENT_POLISHED_RECIPE_VERSION = 1
export const EVENT_POLISHED_DARKTABLE_VERSION = "darktable 5.6.0"

const recipeModules = {
  darktable: {
    workflow: "scene-referred built-in defaults",
    requiredDeveloperVersion: EVENT_POLISHED_DARKTABLE_VERSION,
    autoPresets: "built-in-only",
    exposure: { module: "exposure", moduleVersion: 7, compensationEv: 1.15 },
    sharpen: { module: "sharpen", moduleVersion: 1, radius: 0.65, amount: 0.5, threshold: 0.1 },
    whiteBalance: { mode: "camera-reference" },
    toneAndColor: { mode: "darktable scene-referred defaults" },
    denoise: { mode: "camera-profile built-in preset when available" },
    optics: { mode: "automatic-if-known", implementation: "lensfun stage" },
  },
  fallbackRaster: { gamma: 1.08, linearScale: 0.97, linearOffset: 3, brightness: 1.04, saturation: 1.10, median: 3, sharpenSigma: 0.6 },
} as const

export const EVENT_POLISHED_RECIPE_MANIFEST = JSON.stringify({
  id: "event-polished",
  version: EVENT_POLISHED_RECIPE_VERSION,
  output: { colourspace: "sRGB", channels: 3, depth: 16, format: "tiff" },
  modules: recipeModules,
})

// Sidecar ejecutable y aislado: las dos entradas se decodifican como estructuras
// nativas de darktable 5.6; los presets integrados dependientes de cámara siguen
// disponibles, mientras `--apply-custom-presets false` excluye los personales.
export const EVENT_POLISHED_XMP = `<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about="" xmlns:darktable="http://darktable.sf.net/" xmlns:dc="http://purl.org/dc/elements/1.1/"
      darktable:xmp_version="4" darktable:raw_params="0" darktable:auto_presets_applied="0" darktable:history_end="2" darktable:iop_order_version="2">
      <dc:description><rdf:Alt><rdf:li xml:lang="x-default">${EVENT_POLISHED_RECIPE_MANIFEST}</rdf:li></rdf:Alt></dc:description>
      <darktable:history><rdf:Seq>
        <rdf:li darktable:num="0" darktable:operation="exposure" darktable:enabled="1" darktable:modversion="7" darktable:params="00000000000000003333933f00004842000080c00000000001000000" darktable:multi_name="" darktable:multi_priority="0" darktable:blendop_version="13" darktable:blendop_params="gz11eJxjYGBgkGAAgRNODGiAEV0AJ2iwh+CRyscOAAdeGQQ="/>
        <rdf:li darktable:num="1" darktable:operation="sharpen" darktable:enabled="1" darktable:modversion="1" darktable:params="6666263f0000003fcdcccc3d" darktable:multi_name="" darktable:multi_priority="0" darktable:blendop_version="13" darktable:blendop_params="gz11eJxjYGBgkGAAgRNODGiAEV0AJ2iwh+CRyscOAAdeGQQ="/>
      </rdf:Seq></darktable:history>
      <darktable:masks_history><rdf:Seq /></darktable:masks_history>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>
`

export const EVENT_POLISHED_RECIPE_SHA256 = createHash("sha256").update(EVENT_POLISHED_XMP).digest("hex")

export async function ensureEventPolishedRecipe(dataDirectory: string): Promise<{ path: string; relativePath: string; sha256: string; version: number }> {
  const relativePath = path.join("recipes", `event-polished-v${EVENT_POLISHED_RECIPE_VERSION}-${EVENT_POLISHED_RECIPE_SHA256.slice(0, 12)}.xmp`)
  const destination = path.join(dataDirectory, relativePath)
  const temporary = `${destination}.tmp`
  await mkdir(path.dirname(destination), { recursive: true })
  await writeFile(temporary, EVENT_POLISHED_XMP, "utf8")
  await rm(destination, { force: true })
  await rename(temporary, destination)
  return { path: destination, relativePath, sha256: EVENT_POLISHED_RECIPE_SHA256, version: EVENT_POLISHED_RECIPE_VERSION }
}
