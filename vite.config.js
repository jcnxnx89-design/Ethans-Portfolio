import { defineConfig } from 'vite'
import { copyFileSync, mkdirSync } from 'fs'
import { join } from 'path'

export default defineConfig({
  root: './',
  publicDir: false,
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
    copyPublicDir: false,
    assetsInlineLimit: 4096,
    sourcemap: false,
    target: 'es2020'
  },
  plugins: [
    {
      name: 'copy-assets',
      apply: 'build',
      writeBundle() {
        try {
          const src = 'assets'
          const dest = 'dist/assets'
          mkdirSync(dest, { recursive: true })
          
          const fs = require('fs')
          const path = require('path')
          
          function copyDir(source, destination) {
            const files = fs.readdirSync(source)
            files.forEach(file => {
              const srcPath = path.join(source, file)
              const destPath = path.join(destination, file)
              const stat = fs.statSync(srcPath)
              
              if (stat.isDirectory()) {
                mkdirSync(destPath, { recursive: true })
                copyDir(srcPath, destPath)
              } else {
                copyFileSync(srcPath, destPath)
              }
            })
          }
          
          copyDir(src, dest)
          console.log('✓ Assets copied to dist/')
        } catch (err) {
          console.error('Failed to copy assets:', err)
        }
      }
    }
  ],
  server: {
    port: 5173,
    open: true
  }
})
