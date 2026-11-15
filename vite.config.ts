import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // The bundled province GeoJSON makes the single chunk a little over the default limit.
  build: { chunkSizeWarningLimit: 700 },
  test: {
    environment: 'node',
    // Generating the dummy fire and aerosol data takes a few seconds; leave headroom on a busy machine.
    testTimeout: 20000,
  },
} as Parameters<typeof defineConfig>[0])
