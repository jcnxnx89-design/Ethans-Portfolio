import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    minify: 'terser',
    rollupOptions: {
      output: {
        manualChunks: {
          'three': ['three']
        }
      }
    },
    sourcemap: false,
    target: 'es2020'
  },
  server: {
    port: 5173,
    open: true
  }
})
