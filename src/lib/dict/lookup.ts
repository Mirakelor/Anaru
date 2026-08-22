import { katakanaToHiragana } from '../nlp/romaji';

export interface DictEntry {
  kanji: string | null;
  reading: string;
  pos: string;
  gloss: string;
  jlpt: number | null;
  common: boolean;
}

interface RawEntry {
  k: string | null;
  r: string;
  p: string;
  g: string;
  j: number | null;
  c: 0 | 1;
}

interface DictFile {
  v: number;
  entries: RawEntry[];
  index: Record<string, number[]>;
}

let dictPromise: Promise<DictFile> | null = null;

export function loadDictionary(url = `${import.meta.env.BASE_URL}dict-data.json`): Promise<DictFile> {
  if (!dictPromise) {
    dictPromise = fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`Dictionary download failed (${r.status})`);
        return r.json() as Promise<DictFile>;
      })
      .catch((err) => {
        dictPromise = null;
        throw err;
      });
  }
  return dictPromise;
}

function normalize(text: string): string {
  return katakanaToHiragana(text.trim());
}

function toEntry(raw: RawEntry): DictEntry {
  return { kanji: raw.k, reading: raw.r, pos: raw.p, gloss: raw.g, jlpt: raw.j, common: raw.c === 1 };
}

function rank(entries: DictEntry[]): DictEntry[] {
  return entries.sort((a, b) => {
    if (a.common !== b.common) return a.common ? -1 : 1;
    const la = a.jlpt ?? 6;
    const lb = b.jlpt ?? 6;
    return la - lb;
  });
}

/** Look up dictionary entries for a surface form or dictionary form. */
export async function lookupWord(surface: string, baseForm?: string, reading?: string): Promise<DictEntry[]> {
  const dict = await loadDictionary();
  const results = new Map<number, RawEntry>();
  const candidates = [surface, baseForm, reading].filter((x): x is string => Boolean(x)).map(normalize);
  candidates.push(...candidates.map(katakanaToHiragana));
  for (const key of new Set(candidates)) {
    for (const idx of dict.index[key] ?? []) {
      results.set(idx, dict.entries[idx]);
    }
  }
  return rank([...results.values()].map(toEntry));
}

