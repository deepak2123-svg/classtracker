import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    // Target Chrome 87+ / Android WebView from ~2020 onwards.
    // This covers older vivo/Oppo/Xiaomi devices running stock or
    // OEM browsers that don't fully support ES2022+ syntax.
    target: ['chrome87', 'firefox78', 'safari13', 'edge88'],
  },
  optimizeDeps: {
    // Force Vite to pre-bundle tabler icons so its internal syntax
    // is also transpiled down to the build target above.
    include: ['@tabler/icons-react'],
  },
})
