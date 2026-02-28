import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./manifest.json";

export default defineConfig({
	plugins: [react(), crx({ manifest })],
	// Optional: If you run into port issues during HMR, uncomment this:
	// server: { port: 5173, strictPort: true, hmr: { port: 5173 } }
});
