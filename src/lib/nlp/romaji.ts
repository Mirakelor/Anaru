const KANA_ROMAJI: Record<string, string> = {
  'あ': 'a', 'い': 'i', 'う': 'u', 'え': 'e', 'お': 'o',
  'か': 'ka', 'き': 'ki', 'く': 'ku', 'け': 'ke', 'こ': 'ko',
  'さ': 'sa', 'し': 'shi', 'す': 'su', 'せ': 'se', 'そ': 'so',
  'た': 'ta', 'ち': 'chi', 'つ': 'tsu', 'て': 'te', 'と': 'to',
  'な': 'na', 'に': 'ni', 'ぬ': 'nu', 'ね': 'ne', 'の': 'no',
  'は': 'ha', 'ひ': 'hi', 'ふ': 'fu', 'へ': 'he', 'ほ': 'ho',
  'ま': 'ma', 'み': 'mi', 'む': 'mu', 'め': 'me', 'も': 'mo',
  'や': 'ya', 'ゆ': 'yu', 'よ': 'yo',
  'ら': 'ra', 'り': 'ri', 'る': 'ru', 'れ': 're', 'ろ': 'ro',
  'わ': 'wa', 'ゐ': 'wi', 'ゑ': 'we', 'を': 'wo', 'ん': 'n',
  'が': 'ga', 'ぎ': 'gi', 'ぐ': 'gu', 'げ': 'ge', 'ご': 'go',
  'ざ': 'za', 'じ': 'ji', 'ず': 'zu', 'ぜ': 'ze', 'ぞ': 'zo',
  'だ': 'da', 'ぢ': 'ji', 'づ': 'zu', 'で': 'de', 'ど': 'do',
  'ば': 'ba', 'び': 'bi', 'ぶ': 'bu', 'べ': 'be', 'ぼ': 'bo',
  'ぱ': 'pa', 'ぴ': 'pi', 'ぷ': 'pu', 'ぺ': 'pe', 'ぽ': 'po',
  'きゃ': 'kya', 'きゅ': 'kyu', 'きょ': 'kyo',
  'しゃ': 'sha', 'しゅ': 'shu', 'しょ': 'sho',
  'ちゃ': 'cha', 'ちゅ': 'chu', 'ちょ': 'cho',
  'にゃ': 'nya', 'にゅ': 'nyu', 'にょ': 'nyo',
  'ひゃ': 'hya', 'ひゅ': 'hyu', 'ひょ': 'hyo',
  'みゃ': 'mya', 'みゅ': 'myu', 'みょ': 'myo',
  'りゃ': 'rya', 'りゅ': 'ryu', 'りょ': 'ryo',
  'ぎゃ': 'gya', 'ぎゅ': 'gyu', 'ぎょ': 'gyo',
  'じゃ': 'ja', 'じゅ': 'ju', 'じょ': 'jo',
  'びゃ': 'bya', 'びゅ': 'byu', 'びょ': 'byo',
  'ぴゃ': 'pya', 'ぴゅ': 'pyu', 'ぴょ': 'pyo',
  'ふぁ': 'fa', 'ふぃ': 'fi', 'ふぇ': 'fe', 'ふぉ': 'fo',
  'てぃ': 'ti', 'でぃ': 'di', 'うぃ': 'wi', 'うぇ': 'we', 'うぉ': 'wo',
  'ゔ': 'vu', 'ゔぁ': 'va', 'ゔぃ': 'vi', 'ゔぇ': 've', 'ゔぉ': 'vo',
};

const SMALL_YA = new Set(['ゃ', 'ゅ', 'ょ']);
const KATAKANA_BASE = 0x30a1;
const HIRAGANA_BASE = 0x3041;

export function katakanaToHiragana(text: string): string {
  let out = '';
  for (const ch of text) {
    const code = ch.codePointAt(0)!;
    if (code >= KATAKANA_BASE && code <= KATAKANA_BASE + 85) {
      out += String.fromCodePoint(code - KATAKANA_BASE + HIRAGANA_BASE);
    } else if (ch === 'ー') {
      out += '';
    } else {
      out += ch;
    }
  }
  return out;
}

const VOWELS = new Set(['a', 'i', 'u', 'e', 'o']);

/** Convert a kana string to modified Hepburn romaji. */
export function toRomaji(kanaInput: string): string {
  const kana = katakanaToHiragana(kanaInput);
  const chars = [...kana];
  let out = '';
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    if (ch === 'っ' || ch === 'ッ') {
      const next = chars[i + 1];
      if (next) {
        const nextRomaji = KANA_ROMAJI[next] ?? '';
        if (nextRomaji && !VOWELS.has(nextRomaji[0]) && nextRomaji[0] !== 'n') {
          out += nextRomaji[0];
        }
      }
      continue;
    }
    const digraph = ch + (chars[i + 1] ?? '');
    if (SMALL_YA.has(chars[i + 1]) && KANA_ROMAJI[digraph]) {
      out += KANA_ROMAJI[digraph];
      i++;
      continue;
    }
    if (ch === 'ん') {
      const next = chars[i + 1];
      const nextRomaji = next ? (KANA_ROMAJI[next] ?? '') : '';
      const first = nextRomaji[0];
      if (!next) out += 'n';
      else if (first === 'b' || first === 'm' || first === 'p') out += 'm';
      else if (VOWELS.has(first) || first === 'y') out += "n'";
      else out += 'n';
      continue;
    }
    if (KANA_ROMAJI[ch]) {
      out += KANA_ROMAJI[ch];
      continue;
    }
    if (/[！？。，、・～…]/.test(ch)) {
      const map: Record<string, string> = { '！': '!', '？': '?', '。': '.', '、': ',', '・': ' ', '～': '~', '…': '…' };
      out += map[ch] ?? ' ';
      continue;
    }
    if (ch === ' ' || ch === '　') {
      out += ' ';
      continue;
    }
    out += ch;
  }
  return out.replace(/\s+/g, ' ').replace(/(^ +| +$)/g, '').replace(/ +([.!?])/g, '$1');
}
