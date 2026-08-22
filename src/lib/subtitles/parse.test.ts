import { describe, expect, it } from 'vitest';
import { parseSrt, parseAss, parseSubtitles } from './parse';

const SRT = `1
00:00:01,000 --> 00:00:02,500
すごい！

2
00:00:03,000 --> 00:00:05,200
本当に強いんだな

3
00:01:10,000 --> 00:01:12,000
逃げろ！
`;

const ASS = `[Script Info]
Title: Test

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.00,0:00:02.50,Default,,0,0,0,,{\\b1}すごい{\\b0}ですね！
Dialogue: 0,0:00:03.00,0:00:05.20,Default,,0,0,0,,本当に\\N強いんだな
`;

describe('parseSrt', () => {
  it('parses cues with timing and text', () => {
    const cues = parseSrt(SRT);
    expect(cues).toHaveLength(3);
    expect(cues[0]).toMatchObject({ start: 1, end: 2.5, text: 'すごい！' });
    expect(cues[2].start).toBeCloseTo(70, 5);
  });

  it('handles CRLF and BOM', () => {
    const cues = parseSrt('\uFEFF' + SRT.replace(/\n/g, '\r\n'));
    expect(cues).toHaveLength(3);
  });

  it('strips inline html-like tags', () => {
    const cues = parseSrt('1\n00:00:01,000 --> 00:00:02,000\n<i>すごい</i>\n');
    expect(cues[0].text).toBe('すごい');
  });
});

describe('parseAss', () => {
  it('parses dialogue lines with centisecond timing', () => {
    const cues = parseAss(ASS);
    expect(cues).toHaveLength(2);
    expect(cues[0].start).toBeCloseTo(1, 5);
    expect(cues[0].end).toBeCloseTo(2.5, 5);
    expect(cues[0].text).toBe('すごいですね！');
  });

  it('joins hard line breaks and drops soft breaks', () => {
    const cues = parseAss(ASS);
    expect(cues[1].text).toBe('本当に\n強いんだな');
  });
});

describe('parseSubtitles', () => {
  it('detects format by extension', () => {
    expect(parseSubtitles('a.srt', SRT)).toHaveLength(3);
    expect(parseSubtitles('a.ass', ASS)).toHaveLength(2);
  });

  it('detects format by content when extension is unknown', () => {
    expect(parseSubtitles('a.txt', SRT)).toHaveLength(3);
    expect(parseSubtitles('a.txt', ASS)).toHaveLength(2);
  });

  it('throws on unsupported content', () => {
    expect(() => parseSubtitles('a.txt', 'nothing here')).toThrow(/Unsupported/);
  });
});
