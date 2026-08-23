let voices: SpeechSynthesisVoice[] | null = null;

export function ttsAvailable(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

function refreshVoices() {
  if (!ttsAvailable()) return;
  voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) {
    window.speechSynthesis.addEventListener('voiceschanged', refreshVoices, { once: true });
  }
}

export function japaneseVoice(): SpeechSynthesisVoice | null {
  if (!ttsAvailable()) return null;
  if (voices === null) refreshVoices();
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
