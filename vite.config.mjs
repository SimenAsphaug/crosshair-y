import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "src/renderer");

export default defineConfig({
  root,
  base: "./",
  plugins: [react()],
  server: { port: 5199, strictPort: true },
  build: {
    outDir: resolve(__dirname, "dist/renderer"),
    emptyOutDir: true,
    target: "chrome130",
    rollupOptions: {
      input: {
        index: resolve(root, "index.html"),
        overlay: resolve(root, "overlay.html"),
      },
    },
  },
});
