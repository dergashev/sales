import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // Токены и шрифты живут в дизайн-системе и НЕ копируются в src:
      // копия стала бы вторым источником правды.
      '@ds': fileURLToPath(new URL('./design-system', import.meta.url)),
    },
  },
  server: { port: 5173, open: false },
})
