import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/life-evolution-theatre/',
  server: {
    proxy: {
      '/api/pbdb': {
        target: 'https://paleobiodb.org',
        changeOrigin: true,
        secure: true,
        // 长连接复用 + 更宽容的超时，缓解境外 API 被 RST 的问题
        timeout: 45_000,
        proxyTimeout: 45_000,
        rewrite: (path) => path.replace(/^\/api\/pbdb/, ''),
      },
      '/api/nanobanana': {
        target: 'https://api.nanobananaapi.ai',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/nanobanana/, ''),
      },
      '/api/stability': {
        target: 'https://api.stability.ai',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/stability/, ''),
      },
      '/api/openai': {
        target: 'https://api.openai.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/openai/, ''),
      },
      '/api/replicate': {
        target: 'https://api.replicate.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/replicate/, ''),
      },
    },
  },
})
