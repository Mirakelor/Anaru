// Generates the static SEO word pages under site/learn/ from the runtime
// dictionary (public/dict-data.json). Mirrors the reference site's structure:
// a word index plus one page per word with reading, meaning and JLPT badge.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const outDir = path.join(root, 'site', 'learn');
mkdirSync(outDir, { recursive: true });

const dict = JSON.parse(readFileSync(path.join(root, 'public', 'dict-data.json'), 'utf8'));
const entries = dict.entries;

const KANA_ROMAJI = {
  'あ':'a','い':'i','う':'u','え':'e','お':'o','か':'ka','き':'ki','く':'ku','け':'ke','こ':'ko',
  'さ':'sa','し':'shi','す':'su','せ':'se','そ':'so','た':'ta','ち':'chi','つ':'tsu','て':'te','と':'to',
  'な':'na','に':'ni','ぬ':'nu','ね':'ne','の':'no','は':'ha','ひ':'hi','ふ':'fu','へ':'he','ほ':'ho',
  'ま':'ma','み':'mi','む':'mu','め':'me','も':'mo','や':'ya','ゆ':'yu','よ':'yo','ら':'ra','り':'ri',
  'る':'ru','れ':'re','ろ':'ro','わ':'wa','を':'wo','ん':'n','が':'ga','ぎ':'gi','ぐ':'gu','げ':'ge','ご':'go',
  'ざ':'za','じ':'ji','ず':'zu','ぜ':'ze','ぞ':'zo','だ':'da','ぢ':'ji','づ':'zu','で':'de','ど':'do',
  'ば':'ba','び':'bi','ぶ':'bu','べ':'be','ぼ':'bo','ぱ':'pa','ぴ':'pi','ぷ':'pu','ぺ':'pe','ぽ':'po',
  'きゃ':'kya','きゅ':'kyu','きょ':'kyo','しゃ':'sha','しゅ':'shu','しょ':'sho','ちゃ':'cha','ちゅ':'chu','ちょ':'cho',
  'にゃ':'nya','にゅ':'nyu','にょ':'nyo','ひゃ':'hya','ひゅ':'hyu','ひょ':'hyo','みゃ':'mya','みゅ':'myu','みょ':'myo',
  'りゃ':'rya','りゅ':'ryu','りょ':'ryo','ぎゃ':'gya','ぎゅ':'gyu','ぎょ':'gyo','じゃ':'ja','じゅ':'ju','じょ':'jo',
  'びゃ':'bya','びゅ':'byu','びょ':'byo','ぴゃ':'pya','ぴゅ':'pyu','ぴょ':'pyo','ふぁ':'fa','ふぃ':'fi','ふぇ':'fe','ふぉ':'fo',
};

function toRomaji(kana) {
  const chars = [...kana];
  let out = '';
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    if (ch === 'っ') {
      const next = KANA_ROMAJI[chars[i + 1]];
      if (next && !'aeiou'.includes(next[0]) && next[0] !== 'n') out += next[0];
      continue;
    }
    const digraph = ch + (chars[i + 1] ?? '');
    if (KANA_ROMAJI[digraph]) { out += KANA_ROMAJI[digraph]; i++; continue; }
    if (ch === 'ん') {
      const nr = chars[i + 1] ? (KANA_ROMAJI[chars[i + 1]] ?? '') : '';
      out += !nr ? 'n' : 'bmp'.includes(nr[0]) ? 'm' : 'aeiouy'.includes(nr[0]) ? "n'" : 'n';
      continue;
    }
    out += KANA_ROMAJI[ch] ?? ch;
  }
  return out;
}

function rubyHtml(surface, readingKana) {
  if (!readingKana) return escapeHtml(surface);
  const reading = readingKana;
  const hasKanji = /[\u4e00-\u9fff]/.test(surface);
  if (!hasKanji) return escapeHtml(surface);
  if (!/[\u3040-\u30ff]/.test(surface)) {
    return `<ruby>${escapeHtml(surface)}<rt>${escapeHtml(reading)}</rt></ruby>`;
  }
  // split into kanji / kana runs and align greedily
  const runs = [];
  for (const ch of surface) {
    const kanji = /[\u4e00-\u9fff]/.test(ch);
    const last = runs[runs.length - 1];
    if (last && last.kanji === kanji) last.text += ch;
    else runs.push({ text: ch, kanji });
  }
  let idx = 0;
  let ok = true;
  const parts = [];
  for (let r = 0; r < runs.length; r++) {
    const run = runs[r];
    if (!run.kanji) {
      if (reading.startsWith(run.text, idx)) { parts.push(escapeHtml(run.text)); idx += run.text.length; }
      else { ok = false; break; }
    } else {
      const nextKana = runs.slice(r + 1).find((x) => !x.kanji);
      if (!nextKana) { parts.push(`<ruby>${escapeHtml(run.text)}<rt>${escapeHtml(reading.slice(idx) || '')}</rt></ruby>`); idx = reading.length; }
      else {
        const found = reading.indexOf(nextKana.text, idx);
        if (found === -1) { ok = false; break; }
        parts.push(`<ruby>${escapeHtml(run.text)}<rt>${escapeHtml(reading.slice(idx, found))}</rt></ruby>`);
        idx = found;
      }
    }
  }
  if (!ok) return `<ruby>${escapeHtml(surface)}<rt>${escapeHtml(reading)}</rt></ruby>`;
  return parts.join('');
}

function escapeHtml(text) {
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// pick common words with JLPT levels, prefer kanji spellings, dedupe by slug
const used = new Set();
const words = [];
for (const entry of entries) {
  if (!entry.j || entry.j > 3) continue;
  if (!entry.k) continue;
  const slug = toRomaji(entry.r).replace(/[^a-z']/g, '') || 'word';
  let finalSlug = slug;
  let n = 2;
  while (used.has(finalSlug)) finalSlug = `${slug}-${n++}`;
  used.add(finalSlug);
  words.push({ ...entry, slug: finalSlug, romaji: toRomaji(entry.r) });
  if (words.length >= 2400) break;
}
words.sort((a, b) => (a.j - b.j) || (a.c - b.c));

const NAV = `
<header class="nav" id="nav"><a class="brand" href="/"><img src="/icons/icon-192.png" alt="" width="30" height="30"><span>Anaru</span></a><nav class="nav-right"><a class="nav-link" href="/learn/">Words</a><a class="nav-cta" href="/app/">Open the app</a></nav></header>`;

const FOOTER = `
<footer class="footer"><span>Anaru</span><nav><a href="/learn/">Words</a><a href="/privacy-policy">Privacy</a><a href="/terms-of-service">Terms</a><a href="/app/">App</a></nav><span class="muted">© 2026</span></footer>`;

const CTABLOCK = (word) => `
<section class="word-cta"><h2>Learn ${escapeHtml(word.k)} the way you'll remember it</h2>
<p>Anaru teaches ${escapeHtml(word.k)} and thousands of words through the anime scenes you import, with furigana and a built-in review deck. Free, offline, on every platform.</p>
<div class="cta cta-row"><a class="appbtn" href="/app/">Open the app</a></div></section>`;

// index page
const cards = words
  .map((w) => `<a class="word-card" href="/learn/${w.slug}/"><span class="wc-jlpt n${w.j}">N${w.j}</span><span class="wc-kanji">${escapeHtml(w.k)}</span><span class="wc-mean">${escapeHtml(w.g.split('; ')[0])}</span></a>`)
  .join('\n');

const indexHtml = `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Japanese words from anime — meanings, readings and levels | Anaru</title>
<meta name="description" content="Browse common Japanese words with kanji, readings, JLPT level and meanings. Meet them in real scenes: import the anime you watch and Anaru builds lessons around it.">
<link rel="canonical" href="https://anaru.sonder.eu.org/learn/">
<meta property="og:title" content="Japanese words from anime — meanings, readings and levels | Anaru">
<link rel="icon" type="image/png" href="/icons/icon-192.png">
<link rel="stylesheet" href="/styles.css"></head><body>${NAV}
<main class="word"><section class="word-hero"><h1>Japanese words from anime</h1>
<p class="word-meaning">Common words with furigana, reading and JLPT level. Meet them in real scenes: import the anime you watch and Anaru turns every line into a lesson.</p></section>
<div class="word-grid">${cards}</div>
${CTABLOCK(words[0])}</main>${FOOTER}
<script src="/main.js"></script></body></html>`;
writeFileSync(path.join(outDir, 'index.html'), indexHtml);

// per-word pages
for (const w of words) {
  const page = `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(w.k)} (${w.romaji}) meaning: &quot;${escapeHtml(w.g.split('; ')[0])}&quot; — Learn Japanese with anime | Anaru</title>
<meta name="description" content="${escapeHtml(w.k)} (${w.romaji}) means &quot;${escapeHtml(w.g.split('; ')[0])}&quot; in Japanese (N${w.j}). Meet it in real scenes: import anime with Japanese subtitles and Anaru turns every line into a lesson.">
<link rel="canonical" href="https://anaru.sonder.eu.org/learn/${w.slug}/">
<meta property="og:title" content="${escapeHtml(w.k)} (${w.romaji}) meaning: &quot;${escapeHtml(w.g.split('; ')[0])}&quot; — Learn Japanese with anime | Anaru">
<link rel="icon" type="image/png" href="/icons/icon-192.png">
<link rel="stylesheet" href="/styles.css"></head><body>${NAV}
<main class="word"><p class="crumb"><a href="/learn/">← All words</a></p>
<section class="word-hero"><span class="jlpt n${w.j}">N${w.j}</span>
<h1>${rubyHtml(w.k, w.r)}</h1>
<p class="word-romaji">${w.romaji}</p><p class="word-meaning">${escapeHtml(w.g)}</p></section>
${CTABLOCK(w)}</main>${FOOTER}
<script src="/main.js"></script></body></html>`;
  writeFileSync(path.join(outDir, `${w.slug}.html`), page);
}

console.log(`learn pages: ${words.length} words + index`);
