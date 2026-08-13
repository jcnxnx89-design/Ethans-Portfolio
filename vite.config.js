import { defineConfig } from 'vite'

export default defineConfig({
  root: './',
  publicDir: 'public',
  build: {
    minify: 'esbuild',
    outDir: 'dist',
    emptyOutDir: true,
    copyPublicDir: true,
    rollupOptions: {
      input: 'index.html',
      output: {
        manualChunks: {
          'three': ['three']
        }
      }
    },
    assetsDir: 'assets',
    sourcemap: false,
    target: 'es2020'
  },
  server: {
    port: 5173,
    open: true
  }
})
