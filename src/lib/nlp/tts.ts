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

const EDGE_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
const WIN_EPOCH = 11644473600;

function edgeDateString(): string {
  const d = new Date();
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${days[d.getUTCDay()]} ${months[d.getUTCMonth()]} ${pad(d.getUTCDate())} ${d.getUTCFullYear()} ${pad(
    d.getUTCHours(),
  )}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} GMT+0000 (Coordinated Universal Time)`;
}

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function logDiag(msg: string) {
  try {
    const log = JSON.parse(localStorage.getItem('anaru-errors') ?? '[]');
    log.push({ t: Date.now(), msg: `tts: ${msg}` });
    localStorage.setItem('anaru-errors', JSON.stringify(log.slice(-10)));
  } catch {
    /* storage unavailable */
  }
}

// Edge TTS over WebSocket — works from any origin (verified: the endpoint
// accepts capacitor:// and tauri:// origins). Used on shells whose speechSynthesis
// has no Japanese voice (e.g. Android without a Japanese TTS pack).
async function speakViaEdgeTts(text: string): Promise<boolean> {
  try {
    let ticks = Math.floor(Date.now() / 1000) + WIN_EPOCH;
    ticks -= ticks % 300; // rounded down to 5 minutes, as the service expects
    ticks *= 10000000;
    if (typeof crypto === 'undefined' || !crypto.subtle) {
      logDiag('edge-tts: crypto.subtle unavailable');
      return false;
    }
    const gec = (await sha256Hex(`${ticks.toFixed(0)}${EDGE_TOKEN}`)).toUpperCase();
    const connId = crypto.randomUUID();
    const ws = new WebSocket(
      `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1` +
        `?TrustedClientToken=${EDGE_TOKEN}&Sec-MS-GEC=${gec}&Sec-MS-GEC-Version=1-143.0.3650.75&ConnectionId=${connId}`,
    );
    const chunks: Blob[] = [];
    return await new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => {
        logDiag('edge-tts timeout, no audio');
        ws.close();
        resolve(false);
      }, 20000);
      ws.onopen = () => {
        try {
          ws.send(
            `X-Timestamp:${edgeDateString()}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n` +
              '{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"true"},' +
              '"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}\r\n',
          );
          const ssml = `<speak version='1.0' xml:lang='ja-JP'><voice name='ja-JP-KeitaNeural'>${escapeXml(
            text.slice(0, 100),
          )}</voice></speak>`;
          ws.send(
            `X-RequestId:${connId}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:${edgeDateString()}Z\r\nPath:ssml\r\n\r\n${ssml}`,
          );
        } catch (err) {
          logDiag(`edge-tts send failed: ${err instanceof Error ? err.message : String(err)}`);
          resolve(false);
        }
      };
      ws.onmessage = (ev) => {
        if (typeof ev.data !== 'string') {
          (ev.data as Blob).arrayBuffer().then((buf: ArrayBuffer) => {
            const bytes = new Uint8Array(buf);
            if (bytes.length < 3) return;
            const headerLen = new DataView(buf).getUint16(0, false);
            const start = 2 + headerLen;
            if (start < bytes.length) chunks.push(new Blob([bytes.slice(start)], { type: 'audio/mpeg' }));
          });
        }
      };
      ws.onerror = () => {
        logDiag('edge-tts websocket error');
        clearTimeout(timer);
        resolve(false);
      };
      ws.onclose = (e) => {
        clearTimeout(timer);
        if (chunks.length > 0) {
          const url = URL.createObjectURL(new Blob(chunks, { type: 'audio/mpeg' }));
          const audio = new Audio(url);
          audio.play().catch((err) => logDiag(`edge-tts audio play rejected: ${err instanceof Error ? err.name : String(err)}`));
          logDiag(`edge-tts ok, audio chunks=${chunks.length} (close ${e.code})`);
          resolve(true);
        } else {
          logDiag(`edge-tts closed (code ${e.code}) without audio`);
          resolve(false);
        }
      };
    });
  } catch (err) {
    logDiag(`edge-tts exception: ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
}

export async function speakJapanese(text: string): Promise<boolean> {
  const isCapacitorAndroid =
    typeof window !== 'undefined' &&
    (window as unknown as { Capacitor?: { getPlatform?: () => string } }).Capacitor?.getPlatform?.() === 'android';
  if (ttsAvailable() && !isCapacitorAndroid) {
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
    logDiag(`tts: no japanese voice (${voices?.length ?? 0} voices)`);
  }
  if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
    return speakViaTauri(text);
  }
  return speakViaEdgeTts(text);
}
