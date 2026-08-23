let voices: SpeechSynthesisVoice[] | null = null;
let voicesPromise: Promise<void> | null = null;

export function ttsAvailable(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

function refreshVoices() {
  if (!ttsAvailable()) return;
  voices = window.speechSynthesis.getVoices();
}

// Android WebView loads voices asynchronously: the first getVoices() call is
// empty and the list only arrives after the voiceschanged event. Wait for it
// (with a timeout) so the Japanese voice is actually available.
function ensureVoices(timeoutMs = 4000): Promise<void> {
  if (!voicesPromise) {
    voicesPromise = new Promise((resolve) => {
      if (!ttsAvailable()) return resolve();
      refreshVoices();
      if (voices && voices.length > 0) return resolve();
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        refreshVoices();
        resolve();
      };
      window.speechSynthesis.addEventListener('voiceschanged', finish, { once: true });
      setTimeout(finish, timeoutMs);
    });
  }
  return voicesPromise;
}

export function japaneseVoice(): SpeechSynthesisVoice | null {
  if (!ttsAvailable()) return null;
  refreshVoices();
  return voices?.find((v) => v.lang.toLowerCase().startsWith('ja')) ?? null;
}

// WebKitGTK (the desktop shell) has no speechSynthesis, so speech goes through
// the Rust tts_speak command (edge-tts CLI, espeak-ng fallback).
async function speakViaTauri(text: string): Promise<boolean> {
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const b64 = await invoke<string>('tts_speak', { text: text.slice(0, 100) });
    const audio = new Audio('data:audio/mpeg;base64,' + b64);
    audio.play().catch(() => undefined);
    return true;
  } catch {
    return false;
  }
}

export async function speakJapanese(text: string): Promise<boolean> {
  if (ttsAvailable()) {
    await ensureVoices();
    const voice = japaneseVoice();
    if (voice) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'ja-JP';
      utterance.voice = voice;
      utterance.rate = 0.9;
      window.speechSynthesis.speak(utterance);
      return true;
    }
  }
  if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
    return speakViaTauri(text);
  }
  return false;
}
