import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      "/run-test":          { target: "http://localhost:4000", changeOrigin: true },
      "/library":           { target: "http://localhost:4000", changeOrigin: true },
      "/reports":           { target: "http://localhost:4000", changeOrigin: true },
      "/playwright-report": { target: "http://localhost:4000", changeOrigin: true },
      "/app-settings":      { target: "http://localhost:4000", changeOrigin: true },
      "/auth":              { target: "http://localhost:4000", changeOrigin: true },
    },
  },
  build: { outDir: "dist" },
});
