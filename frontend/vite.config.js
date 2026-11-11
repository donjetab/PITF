import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { existsSync } from 'node:fs'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  base: process.env.VITE_BASE_PATH || (mode === 'static' ? '/PITF/' : '/'),
  plugins: [react(), {
    name: 'require-static-content',
    buildStart() {
      if (
        mode === 'static' &&
        !existsSync(
          new URL('./public/static-content/content.json', import.meta.url)
        )
      ) {
        throw new Error(
          'Run npm run export:static with the backend running before building static mode.'
        )
      }
    },
  }],
  server: {
    proxy: mode === 'static' ? undefined : {
      '/api': 'http://127.0.0.1:5136',
      '/uploads': 'http://127.0.0.1:5136',
    },
  },
}))

