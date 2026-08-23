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

// Diagnostic: keep the last few uncaught errors in localStorage so a crash
// can be reported from Settings. Only active when Settings -> Diagnostics is
// enabled.
try {
  const diagOn = localStorage.getItem('anaru-diagnostics') === '1';
  const capture = (entry: unknown) => {
    if (!diagOn) return;
    try {
      const log = JSON.parse(localStorage.getItem('anaru-errors') ?? '[]');
      log.push(entry);
      localStorage.setItem('anaru-errors', JSON.stringify(log.slice(-10)));
    } catch {
      /* storage unavailable */
    }
  };
  window.addEventListener('error', (e) => capture({ t: Date.now(), msg: e.message, at: `${e.filename}:${e.lineno}` }));
  window.addEventListener('unhandledrejection', (e) => {
    const reason = e.reason instanceof Error ? `${e.reason.message} @ ${e.reason.stack?.split('\n')[1]?.trim() ?? ''}` : String(e.reason);
    capture({ t: Date.now(), msg: reason });
  });
} catch {
  /* diagnostics must never break startup */
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
