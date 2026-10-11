import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Don't pre-bundle the 3D viewer — serve the patched source as-is so the
  // self-hosted /occt/ path is always used (avoids stale optimize cache in dev).
  optimizeDeps: { exclude: ['online-3d-viewer'] },
  server: {
    headers: {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
    },
  },
})
