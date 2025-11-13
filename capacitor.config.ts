import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.retrying.rorope',
  appName: '바밧줄',
  webDir: 'dist/web',
  android: {
    buildOptions: {
      keystorePath: undefined,
      keystoreAlias: undefined,
      releaseType: 'AAB'
    }
  },
  server: {
    androidScheme: 'https',
    cleartext: false
  }
};

export default config;
