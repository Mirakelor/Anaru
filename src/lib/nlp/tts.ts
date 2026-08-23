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

// WebKitGTK (the desktop shell) has no speechSynthesis at all, so the desktop
// falls back to Google's Translate TTS audio. Media elements are not
// CORS-restricted, so this works from tauri://localhost too.
function playOnlineTts(text: string): boolean {
  try {
    const url =
      'https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=ja&q=' +
      encodeURIComponent(text.slice(0, 80));
    const audio = new Audio(url);
    // Google's translate_tts rejects requests whose Referer is not a web
    // origin (tauri://localhost gets a 400), so strip the referer.
    (audio as HTMLMediaElement & { referrerPolicy?: string }).referrerPolicy = 'no-referrer';
    audio.play().catch(() => undefined);
    return true;
  } catch {
    return false;
  }
}

/** Speaks a word with a Japanese voice. Returns false when TTS is unavailable. */
export function speakJapanese(text: string): boolean {
  if (!ttsAvailable()) return playOnlineTts(text);
  const voice = japaneseVoice();
  if (!voice) return playOnlineTts(text);
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'ja-JP';
  utterance.voice = voice;
  utterance.rate = 0.9;
  window.speechSynthesis.speak(utterance);
  return true;
}
