import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Keep the running app separate from middleware servers used by SSR tests.
  cacheDir: 'node_modules/.vite-dev',
  server: {
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8080',
        configure(proxy) {
          proxy.on('proxyReq', (upstream, request) => {
            const { host, origin } = request.headers
            // Spring allows localhost:5173. Map same-origin loopback aliases only.
            if (
              host &&
              /^(?:localhost|127\.0\.0\.1):\d+$/.test(host) &&
              origin === `http://${host}`
            ) {
              upstream.setHeader('Origin', 'http://localhost:5173')
            }
          })
        },
      },
    },
  },
})
