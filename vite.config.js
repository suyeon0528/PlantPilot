import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5175,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/recharts/')) return 'recharts'
          if (id.includes('/node_modules/d3-') || id.includes('/node_modules/victory-vendor/')) return 'chart-vendor'
        },
      },
    },
  },
})
