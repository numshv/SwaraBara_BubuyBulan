import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // The bundled province GeoJSON makes the single chunk a little over the default limit.
  build: { chunkSizeWarningLimit: 700 },
  test: {
    environment: 'node',
  },
} as Parameters<typeof defineConfig>[0])
