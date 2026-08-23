import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.anaru.app',
  appName: 'Anaru',
  webDir: 'dist',
  backgroundColor: '#000000',
  android: {
    allowMixedContent: false,
    // Edge TTS only serves its WebSocket to a desktop-Chrome-like user agent;
    // the app needs it for word pronunciation when no Japanese TTS voice exists.
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0',
  },
};

export default config;
