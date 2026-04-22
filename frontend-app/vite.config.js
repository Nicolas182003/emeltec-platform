import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // auth-api (puerto 3001)
      '/api/auth': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/api/front': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      // main-api (puerto 3000) — datos de telemetría
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      }
    }
  }
})
