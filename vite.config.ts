import { defineConfig } from "vite"
import tsConfigPaths from "vite-tsconfig-paths"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import viteReact from "@vitejs/plugin-react"

export default defineConfig({
  server: {
    host: true, // Listen on all interfaces (0.0.0.0) for external access
    port: 3000,
    allowedHosts: true, // Allow all hosts for Coder workspace access
  },
  plugins: [
    tsConfigPaths(),
    tanstackStart(),
    // react's vite plugin must come after start's vite plugin
    viteReact(),
  ],
})
