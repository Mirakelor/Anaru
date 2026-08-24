import { describe, expect, it } from 'vitest';
import { storyOrder } from './feed';
import type { Clip, Episode, Series } from './types';

const episodes: Episode[] = [
  { id: 11, seriesId: 1, index: 2, title: 'E2', videoPath: '', videoUrl: null, duration: 0, addedAt: 0 },
  { id: 10, seriesId: 1, index: 1, title: 'E1', videoPath: '', videoUrl: null, duration: 0, addedAt: 0 },
  { id: 21, seriesId: 2, index: 1, title: 'S2E1', videoPath: '', videoUrl: null, duration: 0, addedAt: 0 },
];

const series: Series[] = [
  { id: 1, slug: 'a', title: 'A', posterPath: null, spoilerHidden: false, source: 'pack', addedAt: 100 },
  { id: 2, slug: 'b', title: 'B', posterPath: null, spoilerHidden: false, source: 'pack', addedAt: 200 },
];

const clips: Clip[] = [
  { id: 1, episodeId: 10, seriesId: 1, start: 0, end: 1, order: 0 },
  { id: 2, episodeId: 11, seriesId: 1, start: 0, end: 1, order: 0 },
  { id: 3, episodeId: 10, seriesId: 1, start: 0, end: 1, order: 1 },
  { id: 4, episodeId: 21, seriesId: 2, start: 0, end: 1, order: 0 },
];

describe('storyOrder', () => {
  it('groups series by addedAt, episodes by index, then clip order', () => {
    const ids = storyOrder(clips, episodes, series).map((c) => c.id);
    // Series A (added first) fully before series B; A's episode 1 clips
    // (orders 0, 1) before its episode 2.
    expect(ids).toEqual([1, 3, 2, 4]);
  });

  it('keeps every clip of an episode together even when orders repeat', () => {
    const ids = storyOrder(clips, episodes, series).map((c) => c.id);
    expect(ids[0]).toBe(1);
    expect(ids[1]).toBe(3);
  });
});
