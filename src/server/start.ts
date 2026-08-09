import path from "node:path";
import { fileURLToPath } from "node:url";
import { createSmartStudioServer } from "./app.js";
import { PhotoshopDropletEngine } from "./photoshop-droplet-engine.js";
import { detectPhotoshopGpu } from "./photoshop-gpu.js";

const projectDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const dataDirectory = process.env.SMARTSTUDIO_DATA_DIR ?? path.join(projectDirectory, ".smartstudio-data");
const port = Number(process.env.SMARTSTUDIO_PORT ?? 4173);
const useAdobe = process.env.SMARTSTUDIO_EDITING_ENGINE === "adobe";
const photoshopGpu = useAdobe ? await detectPhotoshopGpu() : null;
const editingEngine = useAdobe
  ? new PhotoshopDropletEngine(dataDirectory, {
      processingRoute: photoshopGpu?.enabled ? "hybrid" : "cpu",
    })
  : undefined;
const app = await createSmartStudioServer({
  dataDirectory,
  staticDirectory: path.join(projectDirectory, "dist/client"),
  logger: false,
  editingEngine
});

await app.listen({ host: "127.0.0.1", port });
