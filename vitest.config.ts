import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vitest/config'

const rootDir = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      '@lib': resolve(rootDir, 'lib'),
    },
  },
  esbuild: {
    tsconfigRaw: {
      compilerOptions: {
        target: 'ESNext',
        module: 'ESNext',
        strict: true,
      },
    },
  },
  test: {
    environment: 'node',
    include: ['lib/**/*.spec.ts'],
    pool: 'forks',
  },
})
