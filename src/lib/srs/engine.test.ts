import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db';
import { createCard, dueItems, previewIntervals, reviewCard } from './engine';
import type { Word } from '../types';

async function addWord(lemma: string): Promise<number> {
  const word: Word = {
    lemma,
    reading: lemma,
    gloss: 'test gloss',
    pos: 'noun',
    jlpt: 5,
    surface: lemma,
    clipId: null,
    episodeId: null,
    sceneStart: null,
    sceneEnd: null,
    sentence: 'テスト',
    sentenceTranslation: 'test',
    createdAt: Date.now(),
  };
  return (await db.words.add(word as Word))!;
}

beforeEach(async () => {
  await Promise.all([db.words.clear(), db.cards.clear(), db.reviews.clear()]);
});

describe('srs engine', () => {
  it('creates a new card in new state', async () => {
    const wordId = await addWord('強い');
    const card = await createCard(wordId);
    expect(card.state).toBe(0);
    expect(card.reps).toBe(0);
  });

  it('does not duplicate cards', async () => {
    const wordId = await addWord('強い');
    const first = await createCard(wordId);
    const second = await createCard(wordId);
    expect(second.id).toBe(first.id);
  });

  it('reviews a card and schedules the next repetition', async () => {
    const wordId = await addWord('強い');
    const card = await createCard(wordId);
    const now = new Date('2026-08-22T12:00:00Z');
    const updated = await reviewCard(card, 'good', now);
    expect(updated.reps).toBe(1);
    expect(new Date(updated.due).getTime()).toBeGreaterThan(now.getTime());
    const logs = await db.reviews.toArray();
    expect(logs).toHaveLength(1);
    expect(logs[0].wordId).toBe(wordId);
  });

  it('marks only due cards for review', async () => {
    const a = await addWord('強い');
    const b = await addWord('弱い');
    const cardA = await createCard(a);
    const cardB = await createCard(b);
    const now = new Date('2026-08-22T12:00:00Z');
    await reviewCard(cardA, 'good', now);
    await db.cards.update(cardB.id!, { due: '2026-08-20T00:00:00Z' });
    const due = await dueItems(now);
    expect(due).toHaveLength(1);
    expect(due[0].word.lemma).toBe('弱い');
  });

  it('previews four grade intervals', async () => {
    const wordId = await addWord('強い');
    const card = await createCard(wordId);
    const previews = previewIntervals(card);
    expect(previews.map((p) => p.grade)).toEqual(['again', 'hard', 'good', 'easy']);
    expect(previews.every((p) => p.intervalLabel.length > 0)).toBe(true);
  });

});
