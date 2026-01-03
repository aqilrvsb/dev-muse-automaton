import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  define: {
    'import.meta.env.VITE_BUILD_TIME': JSON.stringify(Date.now().toString()),
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      }
    }
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api/whacenter': {
        target: 'https://api.whacenter.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/whacenter/, '/api')
      }
    }
  }
})
