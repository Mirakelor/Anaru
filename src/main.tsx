import React from 'react';
import ReactDOM from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import './styles.css';

// Only the plain web (PWA) needs the service worker. In the Tauri and
// Capacitor shells it intercepts navigation and /dict/ fetches, which breaks
// the tokenizer on Android (subtitle words never become tappable) — and the
// bundled apps already ship their assets locally.
const isPlainWeb =
  typeof window !== 'undefined' &&
  /^https?:$/.test(window.location.protocol) &&
  !/^https?:\/\/(localhost|127\.0\.0\.1)/.test(window.location.href);
if (isPlainWeb) {
  registerSW({ immediate: true });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
