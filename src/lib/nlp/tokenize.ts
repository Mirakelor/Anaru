import type kuromoji from 'kuromoji';
import { katakanaToHiragana, toRomaji } from './romaji';

export interface RubyPart {
  text: string;
  ruby: string | null;
}

export interface FuriganaSegment {
  text: string;
  parts: RubyPart[];
  tokenIndex: number;
  baseForm: string;
  reading: string;
  isWord: boolean;
}

type KuromojiModule = { builder?: unknown; default?: unknown };

// Vendored patched build (see scripts/patch-kuromoji.mjs): falls back to the
// unpacked dict files that Android's aapt2 produces, so the tokenizer works
// on every shell.
async function loadKuromoji(): Promise<{ builder: typeof kuromoji.builder }> {
  const mod = (await import('./vendor/kuromoji.js')) as unknown as KuromojiModule;
  const api = (mod.builder ? mod : mod.default) as { builder: typeof kuromoji.builder };
  return api;
}

function logDiag(msg: string) {
  try {
    if (localStorage.getItem('anaru-diagnostics') !== '1') return;
    const log = JSON.parse(localStorage.getItem('anaru-errors') ?? '[]');
    log.push({ t: Date.now(), msg: `tokenizer: ${msg}` });
    localStorage.setItem('anaru-errors', JSON.stringify(log.slice(-10)));
  } catch {
    /* storage unavailable */
  }
}

let tokenizerPromise: Promise<kuromoji.Tokenizer<kuromoji.IpadicFeatures>> | null = null;

export function initTokenizer(
  dicPath = `${import.meta.env.BASE_URL}dict`,
): Promise<kuromoji.Tokenizer<kuromoji.IpadicFeatures>> {
  if (!tokenizerPromise) {
    tokenizerPromise = loadKuromoji().then(
      (kuromojiApi) =>
        new Promise((resolve, reject) => {
          kuromojiApi.builder({ dicPath }).build((err, tokenizer) => {
            if (err) reject(err);
            else resolve(tokenizer);
          });
        }),
    );
    tokenizerPromise = tokenizerPromise
      .then((t) => {
        logDiag('dict ok');
        return t;
      })
      .catch((err) => {
        // A transient failure (slow dict download, memory pressure) must not
        // poison the tokenizer forever — allow the next call to retry.
        tokenizerPromise = null;
        logDiag(`dict load failed: ${err instanceof Error ? err.message : String(err)}`);
        throw err;
      });
  }
  return tokenizerPromise;
}

function sanitizeReading(reading: string | undefined): string {
  if (!reading || reading === '*') return '';
  return reading.replace(/[′’'＊\s]/g, '');
}

const KANJI_RE = /\p{Script=Han}/u;
const KANA_RE = /[぀-ヿ]/u;

/**
 * Split a token surface into ruby parts so furigana sits only above the
 * kanji portions. Returns null when no ruby annotation is needed.
 */
export function furiganaParts(surface: string, readingKatakana: string): RubyPart[] | null {
  const reading = katakanaToHiragana(sanitizeReading(readingKatakana));
  if (!reading || !KANJI_RE.test(surface)) return null;
  if ([...surface].every((c) => KANA_RE.test(c))) return null;
  if ([...surface].every((c) => KANJI_RE.test(c))) return [{ text: surface, ruby: reading }];

  const runs: { text: string; kanji: boolean }[] = [];
  for (const ch of surface) {
    const kanji = KANJI_RE.test(ch);
    const last = runs[runs.length - 1];
    if (last && last.kanji === kanji) last.text += ch;
    else runs.push({ text: ch, kanji });
  }
  const out: RubyPart[] = [];
  let idx = 0;
  let ok = true;
  for (let r = 0; r < runs.length; r++) {
    const run = runs[r];
    if (!run.kanji) {
      const kanaRun = katakanaToHiragana(run.text);
      if (reading.startsWith(kanaRun, idx)) {
        out.push({ text: run.text, ruby: null });
        idx += kanaRun.length;
      } else {
        ok = false;
        break;
      }
    } else {
      const nextKanaRun = runs.slice(r + 1).find((x) => !x.kanji);
      if (!nextKanaRun) {
        out.push({ text: run.text, ruby: reading.slice(idx) || null });
        idx = reading.length;
      } else {
        const anchor = katakanaToHiragana(nextKanaRun.text);
        const found = reading.indexOf(anchor, idx);
        if (found === -1) {
          ok = false;
          break;
        }
        out.push({ text: run.text, ruby: reading.slice(idx, found) || null });
        idx = found;
      }
    }
  }
  if (!ok) return [{ text: surface, ruby: reading }];
  return out;
}

export interface TokenizedLine {
  segments: FuriganaSegment[];
  romaji: string;
}

export function tokenizeLineSync(
  tokenizer: kuromoji.Tokenizer<kuromoji.IpadicFeatures>,
  text: string,
): TokenizedLine {
  const tokens = tokenizer.tokenize(text);
  const segments: FuriganaSegment[] = [];
  const romajiParts: string[] = [];
  tokens.forEach((token, i) => {
    const surface = token.surface_form;
    const reading = sanitizeReading(token.reading);
    const pronunciation = sanitizeReading(token.pronunciation) || reading;
    const contentPos =
      token.pos === '名詞' ||
      token.pos === '動詞' ||
      token.pos === '形容詞' ||
      token.pos === '形容動詞' ||
      token.pos === '副詞' ||
      token.pos === '感動詞';
    const isWord = contentPos && surface.trim().length > 0 && KANA_RE.test(surface + reading);
    const baseForm = token.basic_form && token.basic_form !== '*' ? token.basic_form : surface;
    segments.push({
      text: surface,
      parts: isWord ? furiganaParts(surface, token.reading ?? '') ?? [{ text: surface, ruby: null }] : [{ text: surface, ruby: null }],
      tokenIndex: i,
      baseForm,
      reading: katakanaToHiragana(reading),
      isWord,
    });
    if (pronunciation) romajiParts.push(toRomaji(pronunciation));
  });
  return { segments, romaji: romajiParts.join(' ').replace(/\s+/g, ' ').trim() };
}

export async function tokenizeLine(text: string): Promise<TokenizedLine> {
  const tokenizer = await initTokenizer();
  return tokenizeLineSync(tokenizer, text);
}
