import { defineConfig } from 'vite'
import { crx } from '@crxjs/vite-plugin'
import { resolve } from 'path'
import manifest from './manifest.json'

export default defineConfig({
  plugins: [crx({ manifest })],
  build: {
    minify: false,
    sourcemap: true,
    rollupOptions: {
      input: {
        warning: resolve(__dirname, 'src/warning/warning.html'),
      },
    },
  },
})
