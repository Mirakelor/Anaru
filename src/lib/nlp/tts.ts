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

/** Speaks a word with a Japanese voice. Returns false when TTS is unavailable. */
export function speakJapanese(text: string): boolean {
  if (!ttsAvailable()) return false;
  const voice = japaneseVoice();
  if (!voice) return false;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'ja-JP';
  utterance.voice = voice;
  utterance.rate = 0.9;
  window.speechSynthesis.speak(utterance);
  return true;
}
