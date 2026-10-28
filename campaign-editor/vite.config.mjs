import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/postcss";
import { fileURLToPath } from "node:url";
import { campaignFilesPlugin, stageCampaigns } from "../tools/campaign-export.mjs";
import { normalizeBasePath } from "../tools/deployment-path.mjs";

const repository = fileURLToPath(new URL("..", import.meta.url));
const editorBasePath = `${normalizeBasePath()}/campaign-editor`;

export default defineConfig({
  base: `${editorBasePath}/`,
  publicDir: "../web/public",
  plugins: [
    react(),
    campaignFilesPlugin(repository, editorBasePath),
    {
      name: "editor-campaign-export",
      closeBundle: () =>
        stageCampaigns(repository, fileURLToPath(new URL("./dist", import.meta.url))),
    },
  ],
  resolve: {
    alias: { "@": fileURLToPath(new URL("../web", import.meta.url)) },
    dedupe: ["react", "react-dom"],
  },
  define: {
    __GRANADEROS_BASE_PATH__: JSON.stringify(editorBasePath),
    __GRANADEROS_GAME_BASE_PATH__: JSON.stringify(normalizeBasePath()),
    __GRANADEROS_BUILD__: JSON.stringify({ version: "campaign-editor", revision: "local" }),
  },
  css: { postcss: { plugins: [tailwindcss()] } },
  server: { fs: { allow: [repository] } },
  build: { outDir: "dist", emptyOutDir: true },
});
