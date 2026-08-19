import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { runtimeIdentityPlugin } from './tools/runtime/vite-plugin-runtime-identity'

export default defineConfig({
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
