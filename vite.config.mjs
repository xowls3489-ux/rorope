import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

export default defineConfig({
  plugins: [svelte()],
  resolve: {
    dedupe: ['pixi.js', '@pixi/utils', '@pixi/core', '@pixi/display', '@pixi/math', '@pixi/events']
  },
  optimizeDeps: {
    include: ['pixi.js']
  },
  server: {
    port: 3000,
    open: true
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: './index.html'
      }
    }
  }
})