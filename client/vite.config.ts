import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const apiProxy = {
  target: "http://localhost:4000",
  changeOrigin: true,
  bypass(req: { headers: { accept?: string }; url?: string }) {
    // Let browser page navigations fall through to SPA, only proxy API/fetch calls
    if (req.headers.accept?.includes("text/html")) return req.url;
  },
};

const sseProxy = {
  ...apiProxy,
  timeout: 0,       // no timeout — SSE connections stay open until client/server closes
  proxyTimeout: 0,
};

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      "/run-test":          sseProxy,
      "/library":           sseProxy,
      "/reports":           apiProxy,
      "/playwright-report": apiProxy,
      "/app-settings":      apiProxy,
      "/auth":              apiProxy,
      "/ai":                apiProxy,
      "/users":             apiProxy,
    },
  },
  build: { outDir: "dist" },
});
