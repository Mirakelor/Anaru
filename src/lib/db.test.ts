import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db, getSettings, updateSettings } from './db';
import { DEFAULT_SETTINGS } from './types';

beforeEach(async () => {
  await Promise.all([
    db.series.clear(),
    db.episodes.clear(),
    db.cues.clear(),
    db.clips.clear(),
    db.words.clear(),
    db.cards.clear(),
    db.reviews.clear(),
    db.settings.clear(),
  ]);
});

describe('settings', () => {
  it('creates defaults on first read', async () => {
    const settings = await getSettings();
    expect(settings.subtitleMode).toBe(DEFAULT_SETTINGS.subtitleMode);
    expect(settings.onboarded).toBe(false);
  });

  it('persists updates', async () => {
    await getSettings();
    await updateSettings({ subtitleMode: 3, playbackRate: 1.25 });
    const settings = await getSettings();
    expect(settings.subtitleMode).toBe(3);
    expect(settings.playbackRate).toBe(1.25);
  });
});

describe('library relations', () => {
  it('links series, episodes and clips', async () => {
    const seriesId = (await db.series.add({
      slug: 'test',
      title: 'Test Series',
      posterPath: null,
      spoilerHidden: false,
      source: 'user',
      addedAt: Date.now(),
    }))!;
    const episodeId = (await db.episodes.add({
      seriesId,
      index: 1,
      title: 'Episode 1',
      videoPath: 'test/e1.mp4',
      videoUrl: null,
      duration: 60,
      addedAt: Date.now(),
    }))!;
    await db.clips.add({ episodeId, seriesId, start: 0, end: 5, order: 0 });
    const clips = await db.clips.where('episodeId').equals(episodeId).toArray();
    expect(clips).toHaveLength(1);
    const bySeries = await db.clips.where('seriesId').equals(seriesId).toArray();
    expect(bySeries).toHaveLength(1);
  });
});
