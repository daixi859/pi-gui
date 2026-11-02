import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const shared = { '@shared': resolve('src/shared') }

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias: shared },
    // 引擎宿主作为独立入口，由 utilityProcess 单独 fork
    build: {
      rollupOptions: {
        input: {
          index: resolve('src/main/index.ts'),
          'agent-host': resolve('src/main/agent-host.ts')
        },
        output: { entryFileNames: '[name].js' }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias: shared },
    // sandbox: true 要求 preload 是 CommonJS
    build: { rollupOptions: { output: { format: 'cjs', entryFileNames: '[name].cjs' } } }
  },
  renderer: {
    plugins: [react(), tailwindcss()],
    resolve: { alias: { ...shared, '@': resolve('src/renderer/src') } }
  }
})
