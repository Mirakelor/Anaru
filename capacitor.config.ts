import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.anaru.app',
  appName: 'Anaru',
  webDir: 'dist',
  backgroundColor: '#000000',
  android: {
    allowMixedContent: false,
  },
};

export default config;
