import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { intlayer } from 'vite-intlayer'

const srcDir = fileURLToPath(new URL('./src', import.meta.url))

// Stub `bun` (and bun-sql driver) on the client bundle only. These modules use
// the Bun runtime and never execute in the browser, but their `import { SQL } from "bun"`
// trips Vite's import analyzer. SSR keeps the real modules via `ssr.external`.
function bunClientStub(): Plugin {
  const STUB_ID = '\0bun-runtime-stub'
  return {
    name: 'bun-client-stub',
    enforce: 'pre',
    resolveId(source, _importer, options) {
      if (options?.ssr) return null
      if (source === 'bun' || source === 'bun:sql') return STUB_ID
      return null
    },
    load(id) {
      if (id === STUB_ID) {
        return [
          'const noop = () => { throw new Error("bun runtime stub: not usable in the browser") };',
          'export class SQL { constructor() { noop() } }',
          'export default { SQL };',
        ].join('\n')
      }
      return null
    },
  }
}

export default defineConfig({
  resolve: {
    alias: {
      '@': srcDir,
    },
  },
  ssr: {
    external: ['bun', 'bun:sql', 'ioredis', 'drizzle-orm/bun-sql'],
  },
  optimizeDeps: {
    exclude: ['bun', 'bun:sql', 'drizzle-orm/bun-sql', 'ioredis'],
  },
  build: {
    rollupOptions: {
      external: ['bun', 'bun:sql'],
    },
  },
  preview: {
    host: 'docker.localhost',
    port: 3000,
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
    allowedHosts: ['docker.localhost'],
    hmr: {
      protocol: 'wss',
      host: 'docker.localhost',
      clientPort: 443,
    },
    watch: {
      usePolling: true,
      interval: 300,
    },
  },
  plugins: [
    bunClientStub(),
    tailwindcss(),
    // intlayer transpiles `.content.*` declarations and generates `.intlayer/` types.
    intlayer(),
    // Exclude content declarations from file-based routing so they aren't treated as
    // routes (the critical intlayer + TanStack Start gotcha).
    tanstackStart({
      router: {
        routeFileIgnorePattern: '.content.(ts|tsx|js|mjs|cjs|jsx|json|jsonc|json5)$',
      },
    }),
    viteReact(),
  ],
})
