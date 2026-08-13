import { defineConfig } from 'vite'

export default defineConfig({
  root: './',
  build: {
    minify: 'esbuild',
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: 'index.html',
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
