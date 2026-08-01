import path from "node:path";
import { fileURLToPath } from "node:url";
import { createSmartStudioServer } from "./app.js";

const projectDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const dataDirectory = process.env.SMARTSTUDIO_DATA_DIR ?? path.join(projectDirectory, ".smartstudio-data");
const port = Number(process.env.SMARTSTUDIO_PORT ?? 4173);
const app = await createSmartStudioServer({
  dataDirectory,
  staticDirectory: path.join(projectDirectory, "dist/client"),
  logger: true
});

await app.listen({ host: "127.0.0.1", port });
