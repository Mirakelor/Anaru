// Builds the runtime dictionary (public/dict-data.json) from JMdict eng-common
// plus JLPT level tags from open-anki-jlpt-decks CSVs.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const rawDir = path.join(root, 'data', 'raw');

const POS_LABELS = {
  n: 'noun', 'n-adv': 'noun', 'n-t': 'noun', 'n-pr': 'name', 'n-suf': 'suffix', 'n-pref': 'prefix',
  'n-unc': 'noun', 'n-vul': 'noun', 'n-masc': 'noun', 'n-fem': 'noun',
  pn: 'pronoun',
  v1: 'verb', v5: 'verb', 'v5u': 'verb', 'v5k': 'verb', 'v5g': 'verb', 'v5s': 'verb', 'v5t': 'verb',
  'v5b': 'verb', 'v5m': 'verb', 'v5r': 'verb', 'v5n': 'verb', 'v5aru': 'verb', 'v5uru': 'verb',
  'v5z': 'verb', 'v5u-s': 'verb', 'v4r': 'verb',
  vk: 'verb', vs: 'verb', vz: 'verb', vn: 'verb', 'vs-c': 'verb', 'vs-s': 'verb', 'vs-i': 'verb',
  vi: 'verb', vt: 'verb', v2a_s: 'verb', 'v-unspec': 'verb',
  'adj-i': 'adjective', 'adj-ix': 'adjective', 'adj-na': 'na-adjective', 'adj-no': 'adjective',
  'adj-f': 'adjective', 'adj-pn': 'adjective', 'adj-nari': 'na-adjective', 'adj-shiku': 'adjective',
  'adj-ku': 'adjective', 'adj-t': 'adjective',
  adv: 'adverb', 'adv-to': 'adverb',
  int: 'interjection', conj: 'conjunction', prt: 'particle',
  aux: 'auxiliary', 'aux-v': 'auxiliary', 'aux-adj': 'auxiliary',
  exp: 'expression', pref: 'prefix', suf: 'suffix', 'cop-da': 'copula', cop: 'copula',
  num: 'number', ctr: 'counter',
};

function posLabel(codes = []) {
  const seen = [];
  for (const c of codes) {
    const label = POS_LABELS[c];
    if (label && !seen.includes(label)) seen.push(label);
    if (seen.length === 2) break;
  }
  return seen.join(', ');
}

function loadJlptLevels() {
  const levels = new Map();
  for (let n = 5; n >= 1; n--) {
    const file = path.join(rawDir, `jlpt-n${n}.csv`);
    if (!existsSync(file)) continue;
    const text = readFileSync(file, 'utf8');
    for (const line of text.split('\n').slice(1)) {
      if (!line.trim()) continue;
      const match = line.match(/^([^,]*),([^,]*),/);
      if (!match) continue;
      const expression = match[1].trim();
      const reading = match[2].trim();
      if (!expression && !reading) continue;
      if (expression && !levels.has(expression)) levels.set(expression, n);
      if (reading && !levels.has(reading)) levels.set(reading, n);
    }
  }
  return levels;
}

function csvParseLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else cur += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

const jmdictFile = path.join(rawDir, 'jmdict-eng-common.json');
if (!existsSync(jmdictFile)) {
  console.error('Missing data/raw/jmdict-eng-common.json — download it first (see README data sources).');
  process.exit(1);
}

console.log('Loading JMdict…');
const parsed = JSON.parse(readFileSync(jmdictFile, 'utf8'));
const entries = Array.isArray(parsed) ? parsed : parsed.words;
console.log(`JMdict common entries: ${entries.length}`);
const jlpt = loadJlptLevels();
console.log(`JLPT vocabulary map: ${jlpt.size} keys`);

const compact = [];
const indexKeys = new Set();

for (const entry of entries) {
  const kanjiTexts = (entry.kanji || []).map((k) => k.text).filter(Boolean);
  const kanaTexts = (entry.kana || []).map((k) => k.text).filter(Boolean);
  const primaryKana = kanaTexts[0] ?? '';
  const primaryKanji = kanjiTexts[0] ?? null;
  if (!primaryKana) continue;
  const pos = posLabel((entry.sense?.[0]?.partOfSpeech) || (entry.sense?.[0]?.pos) || []);
  const glosses = (entry.sense || [])
    .flatMap((s) => s.gloss || [])
    .filter((g) => typeof g === 'string' || g.lang === 'eng' || !g.lang)
    .map((g) => (typeof g === 'string' ? g : g.text))
    .filter((g) => typeof g === 'string' && g.length > 0);
  const gloss = glosses.slice(0, 3).join('; ');
  if (!gloss) continue;
  let level = null;
  for (const key of [...kanjiTexts, ...kanaTexts]) {
    if (jlpt.has(key)) { level = jlpt.get(key); break; }
  }
  const isCommon = (entry.kanji || []).some((k) => k.common) || (entry.kana || []).some((k) => k.common);
  const idx = compact.length;
  compact.push({ k: primaryKanji, r: primaryKana, p: pos, g: gloss, j: level, c: isCommon ? 1 : 0 });
  for (const key of [...kanjiTexts, ...kanaTexts]) indexKeys.add(JSON.stringify([key, idx]));
}

const index = {};
for (const pair of indexKeys) {
  const [key, idx] = JSON.parse(pair);
  (index[key] ||= []).push(idx);
}

mkdirSync(path.join(root, 'public'), { recursive: true });
const out = { v: 1, entries: compact, index };
const outFile = path.join(root, 'public', 'dict-data.json');
writeFileSync(outFile, JSON.stringify(out));
const sizeMb = (Buffer.byteLength(JSON.stringify(out)) / 1024 / 1024).toFixed(2);
console.log(`Wrote ${outFile}: ${compact.length} entries, index keys ${Object.keys(index).length}, ${sizeMb} MB`);
