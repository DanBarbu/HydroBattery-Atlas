import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import cesium from "vite-plugin-cesium";

// Standalone UX demo — no backend. `npm install && npm run dev` and open
// http://localhost:5173. The Cesium globe uses the offline Natural Earth II
// imagery bundled with the cesium package, so it works without an Ion token.
export default defineConfig({
  plugins: [react(), cesium()],
  server: { host: "0.0.0.0", port: 5173 },
  preview: { host: "0.0.0.0", port: 4173 },
});
