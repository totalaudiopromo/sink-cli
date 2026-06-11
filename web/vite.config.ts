import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Vite's default, stated explicitly because the "browser" field swap of
    // datasink's net.js/typo-map.js is load-bearing for this app.
    mainFields: ['browser', 'module', 'jsnext:main', 'jsnext'],
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})
