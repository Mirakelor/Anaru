import { describe, expect, it } from 'vitest';
import { initTokenizer, tokenizeLineSync } from './tokenize';

const dictPath = 'node_modules/kuromoji/dict';

describe('tokenizeLine', () => {
  it('splits a sentence into word segments with readings', async () => {
    const tokenizer = await initTokenizer(dictPath);
    const line = tokenizeLineSync(tokenizer, '本当に強いんだな');
    const surfaces = line.segments.map((s) => s.text).join('');
    expect(surfaces).toBe('本当に強いんだな');
    const strong = line.segments.find((s) => s.text === '強い');
    expect(strong).toBeTruthy();
    expect(strong!.baseForm).toBe('強い');
    expect(strong!.reading).toBe('つよい');
    expect(strong!.isWord).toBe(true);
    expect(strong!.parts).toEqual([
      { text: '強', ruby: 'つよ' },
      { text: 'い', ruby: null },
    ]);
  });

  it('produces romaji for the whole line', async () => {
    const tokenizer = await initTokenizer(dictPath);
    const line = tokenizeLineSync(tokenizer, 'すごいね');
    expect(line.romaji).toBe('sugoi ne');
  });

  it('gives dictionary forms for inflected verbs', async () => {
    const tokenizer = await initTokenizer(dictPath);
    const line = tokenizeLineSync(tokenizer, '逃げろ！');
    const run = line.segments.find((s) => s.text.startsWith('逃げ'));
    expect(run).toBeTruthy();
    expect(run!.baseForm).toBe('逃げる');
  });

  it('does not mark particles or punctuation as tappable words', async () => {
    const tokenizer = await initTokenizer(dictPath);
    const line = tokenizeLineSync(tokenizer, 'これは何ですか？');
    const ha = line.segments.find((s) => s.text === 'は');
    expect(ha!.isWord).toBe(false);
    const q = line.segments.find((s) => s.text === '？');
    expect(q!.isWord).toBe(false);
  });
});
