import { describe, expect, it } from 'vitest';
import { toRomaji, katakanaToHiragana } from './romaji';

describe('kana conversion', () => {
  it('converts katakana to hiragana', () => {
    expect(katakanaToHiragana('スゴイ')).toBe('すごい');
    expect(katakanaToHiragana('トウキョウ')).toBe('とうきょう');
  });
});

describe('toRomaji', () => {
  it('renders basic mora', () => {
    expect(toRomaji('すごい')).toBe('sugoi');
    expect(toRomaji('たべる')).toBe('taberu');
  });

  it('handles double consonants (sokuon)', () => {
    expect(toRomaji('ちょっと')).toBe('chotto');
    expect(toRomaji('ずっと')).toBe('zutto');
    expect(toRomaji('やっぱり')).toBe('yappari');
  });

  it('handles contracted youon sounds', () => {
    expect(toRomaji('きょう')).toBe('kyou');
    expect(toRomaji('しゃしん')).toBe('shashin');
  });

  it('renders n before b/m/p as m', () => {
    expect(toRomaji('さんぽ')).toBe('sampo');
    expect(toRomaji('ほんま')).toBe('homma');
  });

  it('renders plain n word-finally and before other consonants', () => {
    expect(toRomaji('ほん')).toBe('hon');
    expect(toRomaji('にほんご')).toBe('nihongo');
  });

  it('marks n before vowels with an apostrophe', () => {
    expect(toRomaji('ほんお')).toBe("hon'o");
  });

  it('keeps punctuation readable', () => {
    expect(toRomaji('なに？')).toBe('nani?');
    expect(toRomaji('すごい！')).toBe('sugoi!');
  });

  it('handles katakana input', () => {
    expect(toRomaji('アニメ')).toBe('anime');
  });
});
