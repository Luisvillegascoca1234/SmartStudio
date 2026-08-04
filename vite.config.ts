import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src")
    }
  },
  server: {
    proxy: {
      "/api": "http://127.0.0.1:4173",
      "/captures": "http://127.0.0.1:4173",
      "/editing": "http://127.0.0.1:4173"
    }
  },
  build: {
    outDir: "dist/client"
  }
});
