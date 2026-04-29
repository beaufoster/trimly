import { defineConfig } from 'vite'

export default defineConfig({
  root: '.',
  base: process.env.NODE_ENV === 'production' ? '/trimly/' : '/',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      input: {
        main: 'index.html'
      }
    }
  },
  server: {
    port: 3000,
    open: true
  }
})
