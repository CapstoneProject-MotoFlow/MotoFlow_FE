import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Keep the running app separate from middleware servers used by SSR tests.
  cacheDir: 'node_modules/.vite-dev',
  server: {
    host: '0.0.0.0',
    proxy: {
      '/api': 'http://127.0.0.1:8080',
    },
  },
})
