/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  // GitHub Pages serves this project from the repository subpath. Local
  // development and ordinary production builds stay rooted at "/".
  base: process.env.GITHUB_PAGES === 'true' ? '/document-manager-kit/' : '/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5180,
    strictPort: true,
    proxy: {
      // Same-origin proxy for local development: the browser never makes a
      // cross-origin request, so the API needs no CORS configuration.
      '/api': {
        target: process.env.VITE_DEV_API_PROXY ?? 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 5180,
    strictPort: true,
  },
  build: {
    rollupOptions: {
      output: {
        // Split stable third-party code so app updates do not invalidate it.
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'data-vendor': ['@tanstack/react-query', 'zustand'],
          'markdown-vendor': ['react-markdown', 'remark-gfm'],
          'motion-vendor': ['framer-motion'],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    css: false,
    restoreMocks: true,
  },
})
