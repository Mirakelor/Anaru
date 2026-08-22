import { fsrs, Card as FsrsCardType, Rating, State } from 'ts-fsrs';
import { db } from '../db';
import type { CardState, ReviewLog, Word } from '../types';

const f = fsrs({ enable_short_term: false });

export type Grade = 'again' | 'hard' | 'good' | 'easy';

const GRADE_TO_RATING: Record<Grade, Rating> = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy,
};

function toFsrsCard(state: CardState): FsrsCardType {
  return {
    due: new Date(state.due),
    stability: state.stability,
    difficulty: state.difficulty,
    elapsed_days: state.elapsed_days,
    scheduled_days: state.scheduled_days,
    reps: state.reps,
    lapses: state.lapses,
    state: state.state as State,
    learning_steps: state.learning_steps ?? 0,
    last_review: state.last_review ? new Date(state.last_review) : undefined,
  };
}

function fromFsrsCard(wordId: number, card: FsrsCardType, existingId?: number): CardState {
  return {
    id: existingId,
    wordId,
    due: card.due.toISOString(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    learning_steps: card.learning_steps ?? 0,
    last_review: card.last_review?.toISOString(),
  };
}

export async function createCard(wordId: number): Promise<CardState> {
  const existing = await db.cards.where('wordId').equals(wordId).first();
  if (existing) return existing;
  const card: FsrsCardType = {
    due: new Date(),
    stability: 0,
    difficulty: 0,
    elapsed_days: 0,
    scheduled_days: 0,
    reps: 0,
    lapses: 0,
    state: State.New,
    learning_steps: 0,
    last_review: undefined,
  };
  const state = fromFsrsCard(wordId, card);
  const id = await db.cards.add(state as CardState);
  return { ...state, id };
}

export interface DueItem {
  card: CardState;
  word: Word;
}

export async function dueItems(now: Date = new Date()): Promise<DueItem[]> {
  const cards = await db.cards.where('due').belowOrEqual(now.toISOString()).toArray();
  const wordIds = cards.map((c) => c.wordId);
  const words = await db.words.where('id').anyOf(wordIds).toArray();
  const wordById = new Map(words.map((w) => [w.id, w]));
  return cards
    .map((card) => ({ card, word: wordById.get(card.wordId)! }))
    .filter((item) => item.word)
    .sort((a, b) => a.card.due.localeCompare(b.card.due));
}

export interface ReviewPreview {
  grade: Grade;
  intervalLabel: string;
}

export function previewIntervals(card: CardState, now: Date = new Date()): ReviewPreview[] {
  const fsrsCard = toFsrsCard(card);
  return (['again', 'hard', 'good', 'easy'] as Grade[]).map((grade) => {
    const result = f.repeat(fsrsCard, now) as unknown as Record<number, { card: FsrsCardType; log: unknown }>;
    const scheduled = result[GRADE_TO_RATING[grade]];
    return { grade, intervalLabel: formatInterval(scheduled.card.scheduled_days, scheduled.card.state) };
  });
}

function formatInterval(days: number, state: State): string {
  if (state === State.Learning || state === State.Relearning || days < 1) {
    const minutes = Math.max(1, Math.round(days * 24 * 60));
    if (minutes < 60) return `${minutes}m`;
    return `${Math.round(minutes / 60)}h`;
  }
  if (days < 30) return `${Math.round(days)}d`;
  if (days < 365) return `${Math.round(days / 30)}mo`;
  return `${(days / 365).toFixed(1)}y`;
}

export async function reviewCard(card: CardState, grade: Grade, now: Date = new Date()): Promise<CardState> {
  const fsrsCard = toFsrsCard(card);
  const result = f.repeat(fsrsCard, now) as unknown as Record<number, { card: FsrsCardType; log: unknown }>;
  const scheduled = result[GRADE_TO_RATING[grade]];
  const updated = fromFsrsCard(card.wordId, scheduled.card, card.id);
  await db.cards.update(card.id!, updated);
  const log: ReviewLog = {
    wordId: card.wordId,
    rating: GRADE_TO_RATING[grade],
    due: scheduled.card.due.toISOString(),
    stability: scheduled.card.stability,
    difficulty: scheduled.card.difficulty,
    elapsed_days: scheduled.card.elapsed_days,
    scheduled_days: scheduled.card.scheduled_days,
    state: scheduled.card.state,
    reviewedAt: now.getTime(),
  };
  await db.reviews.add(log as ReviewLog);
  return updated;
}

