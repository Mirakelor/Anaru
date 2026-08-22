import { describe, expect, it } from 'vitest';
import { furiganaParts } from './tokenize';

describe('furiganaParts', () => {
  it('returns null for kana-only surfaces', () => {
    expect(furiganaParts('すごい', 'スゴイ')).toBeNull();
  });

  it('returns null when there is no reading', () => {
    expect(furiganaParts('凄い', '')).toBeNull();
  });

  it('ruby over whole surface for pure kanji words', () => {
    expect(furiganaParts('覚悟', 'カクゴ')).toEqual([{ text: '覚悟', ruby: 'かくご' }]);
  });

  it('splits kanji stem from kana okurigana', () => {
    expect(furiganaParts('凄い', 'スゴイ')).toEqual([
      { text: '凄', ruby: 'すご' },
      { text: 'い', ruby: null },
    ]);
    expect(furiganaParts('食べる', 'タベル')).toEqual([
      { text: '食', ruby: 'た' },
      { text: 'べる', ruby: null },
    ]);
  });

  it('handles kanji-kana-kanji patterns', () => {
    expect(furiganaParts('食べ物', 'タベモノ')).toEqual([
      { text: '食', ruby: 'た' },
      { text: 'べ', ruby: null },
      { text: '物', ruby: 'もの' },
    ]);
  });

  it('falls back to full ruby when alignment fails', () => {
    expect(furiganaParts('今日', 'キョウ')).toEqual([{ text: '今日', ruby: 'きょう' }]);
  });

  it('ignores pitch accent markers in readings', () => {
    expect(furiganaParts('凄い', 'スゴ′イ')).toEqual([
      { text: '凄', ruby: 'すご' },
      { text: 'い', ruby: null },
    ]);
  });
});
