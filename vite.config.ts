import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { runtimeIdentityPlugin } from './tools/runtime/vite-plugin-runtime-identity'

/**
 * `base` kommt aus der Umgebung, damit derselbe Quellstand sowohl an einer
 * Wurzel (Entwicklung, Vercel) als auch unter einem Pfadpräfix laufen kann —
 * ein GitHub-Pages-Projektauftritt liegt unter `/<repo>/`. Ohne die Variable
 * bleibt alles wie bisher; das Routenmodell zieht denselben Wert über
 * `import.meta.env.BASE_URL` (siehe `routeBase`, appRoute.ts).
 */
const base = process.env.VITE_BASE ?? '/'

export default defineConfig({
  base,
  // runtimeIdentityPlugin only registers dev/preview server middleware
  // (configureServer/configurePreviewServer) — it has zero effect on `vite
  // build` output, and 404s on every request unless the spawning process
  // set A3_RUNTIME_NONCE, so an ordinary `npm run dev` is unaffected.
  plugins: [react(), runtimeIdentityPlugin()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: { port: 5173, open: false },
})
