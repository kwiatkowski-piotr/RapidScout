import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { defineNuxtConfig } from 'nuxt/config'

const rootDir = fileURLToPath(new URL('.', import.meta.url))

// Nuxt 4 + ssr:false — ten sam stack co działający provider-nuxt w EPG.
// Nuxt 3.21.x ma bug w dev SPA: "Vite Node IPC socket path not configured".
export default defineNuxtConfig({
  ssr: false,
  telemetry: false,
  devtools: { enabled: false },
  devServer: {
    host: 'localhost',
    port: 4201,
  },
  app: {
    head: { title: 'RapidScout' },
  },
  modules: ['@nuxt/ui'],
  css: ['~/assets/css/styles.css'],
  fonts: {
    providers: {
      google: false,
      googleicons: false,
    },
  },
  alias: {
    '@lib': resolve(rootDir, 'lib'),
  },
  vite: {
    cacheDir: resolve(rootDir, 'node_modules/.vite/rapidscout'),
  },
  nitro: {
    alias: {
      '@lib': resolve(rootDir, 'lib'),
    },
  },
  typescript: {
    strict: true,
    typeCheck: false,
  },
  compatibilityDate: '2024-08-24',
})
