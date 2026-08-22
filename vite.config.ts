import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { readFile } from 'node:fs';
import path from 'node:path';

const dictNoEncoding: Plugin = {
  name: 'dict-no-encoding',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      const url = (req.url ?? '').split('?')[0];
      const fileUrl = url.startsWith('/app/') ? url.slice(4) : url;
      if (!fileUrl.startsWith('/dict/')) return next();
      const filePath = path.join(server.config.publicDir, fileUrl);
      readFile(filePath, (err, data) => {
        if (err) return next();
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Length', String(data.length));
        res.setHeader('Cache-Control', 'no-cache');
        res.end(data);
      });
    });
  },
  configurePreviewServer(server) {
    server.middlewares.use((req, res, next) => {
      const url = (req.url ?? '').split('?')[0];
      const fileUrl = url.startsWith('/app/') ? url.slice(4) : url;
      if (!fileUrl.startsWith('/dict/')) return next();
      const filePath = path.join(server.config.root, 'dist', fileUrl);
      readFile(filePath, (err, data) => {
        if (err) return next();
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Length', String(data.length));
        res.setHeader('Cache-Control', 'no-cache');
        res.end(data);
      });
    });
  },
};

export default defineConfig({
  base: '/app/',
  plugins: [
    dictNoEncoding,
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png', 'dict/*.dat', 'dict/*.js'],
      manifest: {
        name: 'Anaru — Learn Japanese by watching anime',
        short_name: 'Anaru',
        description:
          'Real anime scenes with furigana on every kanji. Tap a word to save it, review it like Anki. Free, offline, no account.',
        theme_color: '#000000',
        background_color: '#000000',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/app/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icons/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff2,json}'],
        maximumFileSizeToCacheInBytes: 20 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: /\/dict\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'japanese-dict',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
    }),
  ],
  server: { port: 5173 },
  resolve: {
    alias: {
      kuromoji: 'kuromoji/build/kuromoji.js',
    },
  },
});
