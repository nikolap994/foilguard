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
        options: resolve(__dirname, 'src/options/options.html'),
        onboarding: resolve(__dirname, 'src/onboarding/onboarding.html'),
        sidepanel: resolve(__dirname, 'src/sidepanel/sidepanel.html'),
      },
    },
  },
})
