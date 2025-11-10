import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

export default defineConfig({
  plugins: [svelte()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    open: true
  },
  build: {
    outDir: 'dist',
    target: 'es2015',
    // Production 최적화 설정
    minify: 'terser',
    sourcemap: false,
    terserOptions: {
      compress: {
        drop_console: true, // console.log 제거
        drop_debugger: true, // debugger 제거
        pure_funcs: ['console.log', 'console.info', 'console.debug'], // 특정 함수 호출 제거
      },
      mangle: {
        safari10: true, // Safari 10 호환성
      },
    },
    // 청크 크기 최적화
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          // 라이브러리 코드를 별도 청크로 분리
          'pixi': ['pixi.js'],
          'vendor': ['svelte', 'nanostores'],
        },
        // 파일명 최적화 (캐싱용)
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      }
    },
    // 빌드 성능 최적화
    reportCompressedSize: true,
    cssCodeSplit: true,
  }
})