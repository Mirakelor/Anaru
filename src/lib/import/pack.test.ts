import 'fake-indexeddb/auto';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../db';
import { ingestPack } from './library';

const SRT_JA = `1
00:00:01,000 --> 00:00:02,500
すごい力だな

2
00:00:30,000 --> 00:00:32,000
逃げろ！
`;

const SRT_EN = `1
00:00:01,000 --> 00:00:02,500
What a tremendous power.

2
00:00:30,000 --> 00:00:32,000
Run!
`;

const MANIFEST = {
  version: 1,
  series: [
    {
      slug: 'test-pack',
      title: 'Test Pack',
      poster: null,
      episodes: [
        { index: 1, video: 'media/e1.mp4', subtitle: 'media/e1.ja.srt', translation: 'media/e1.en.srt' },
      ],
    },
  ],
};

const FILES: Record<string, string> = {
  'https://pack.test/manifest.json': JSON.stringify(MANIFEST),
  'https://pack.test/media/e1.ja.srt': SRT_JA,
  'https://pack.test/media/e1.en.srt': SRT_EN,
};

beforeAll(() => {
  Object.defineProperty(window.HTMLMediaElement.prototype, 'duration', {
    configurable: true,
    get: () => 60,
  });
  const descriptor = Object.getOwnPropertyDescriptor(window.HTMLMediaElement.prototype, 'src');
  Object.defineProperty(window.HTMLMediaElement.prototype, 'src', {
    configurable: true,
    get: descriptor?.get,
    set(value) {
      descriptor?.set?.call(this, value);
      setTimeout(() => this.dispatchEvent(new Event('loadedmetadata')), 0);
    },
  });
});

beforeEach(async () => {
  await Promise.all([db.series.clear(), db.episodes.clear(), db.cues.clear(), db.clips.clear()]);
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const body = FILES[url];
      return {
        ok: body !== undefined,
        status: body !== undefined ? 200 : 404,
        json: async () => JSON.parse(body),
        text: async () => body,
      } as Response;
    }),
  );
});

describe('ingestPack', () => {
  it('creates series, episodes, cues and clips from a manifest', async () => {
    const clips = await ingestPack('https://pack.test/manifest.json');
    expect(clips).toBe(2);

    const series = await db.series.toArray();
    expect(series).toHaveLength(1);
    expect(series[0].source).toBe('pack');

    const episodes = await db.episodes.toArray();
    expect(episodes).toHaveLength(1);
    expect(episodes[0].videoUrl).toBe('https://pack.test/media/e1.mp4');
    expect(episodes[0].duration).toBe(60);

    const cues = await db.cues.toArray();
    expect(cues).toHaveLength(2);
    const translated = cues.find((c) => c.text === '逃げろ！');
    expect(translated?.translation).toBe('Run!');

    const clipRows = await db.clips.toArray();
    expect(clipRows).toHaveLength(2);
    expect(clipRows.every((c) => c.seriesId === series[0].id)).toBe(true);
  });

  it('rejects a non-pack URL', async () => {
    await expect(ingestPack('https://pack.test/missing.json')).rejects.toThrow(/404|manifest/i);
  });
});
