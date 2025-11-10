import { defineConfig } from '@apps-in-toss/web-framework/config';

export default defineConfig({
  appName: 'rorope',
  brand: {
    displayName: '바밧줄',
    primaryColor: '#FF6F61',
    icon: 'https://example.com/icon.png',
    bridgeColorMode: 'inverted',
  },
  navigationBar: {
    withBackButton: true,
    withHomeButton: false,
  },
  web: {
    host: 'localhost',
    port: 5173,
    commands: {
      dev: 'vite --host',
      build: 'vite build',
    },
  },
  webViewProps: {
    type: 'game',
  },
  permissions: [],
  outdir: 'dist',
});
