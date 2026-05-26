import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('@tabler/icons-react')) {
            return 'tabler-icons';
          }
        },
      },
    },
  },
})
