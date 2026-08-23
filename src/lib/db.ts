import Dexie, { type EntityTable } from 'dexie';
import type {
  CardState,
  Clip,
  Cue,
  Episode,
  ReviewLog,
  Series,
  Word,
  AppSettings,
} from './types';
import { DEFAULT_SETTINGS } from './types';

export const db = new Dexie('anaru') as Dexie & {
  series: EntityTable<Series, 'id'>;
  episodes: EntityTable<Episode, 'id'>;
  cues: EntityTable<Cue, 'id'>;
  clips: EntityTable<Clip, 'id'>;
  words: EntityTable<Word, 'id'>;
  cards: EntityTable<CardState, 'id'>;
  reviews: EntityTable<ReviewLog, 'id'>;
  settings: EntityTable<AppSettings, 'id'>;
};

db.version(1).stores({
  series: '++id, slug, source, spoilerHidden',
  episodes: '++id, seriesId, [seriesId+index]',
  cues: '++id, episodeId, start',
  clips: '++id, episodeId, seriesId, order',
  words: '++id, lemma, reading, createdAt, clipId',
  cards: '++id, wordId, due, state',
  reviews: '++id, wordId, reviewedAt',
  settings: '++id',
});

db.version(2).stores({
  series: '++id, slug, source, spoilerHidden, addedAt',
  episodes: '++id, seriesId, [seriesId+index]',
  cues: '++id, episodeId, start',
  clips: '++id, episodeId, seriesId, order',
  words: '++id, lemma, reading, createdAt, clipId',
  cards: '++id, wordId, due, state',
  reviews: '++id, wordId, reviewedAt',
  settings: '++id',
});

// Unique slug index: two concurrent imports (onboarding + library auto-import)
// must never produce duplicate series rows.
db.version(3).stores({
  series: '++id, &slug, source, spoilerHidden, addedAt',
  episodes: '++id, seriesId, [seriesId+index]',
  cues: '++id, episodeId, start',
  clips: '++id, episodeId, seriesId, order',
  words: '++id, lemma, reading, createdAt, clipId',
  cards: '++id, wordId, due, state',
  reviews: '++id, wordId, reviewedAt',
  settings: '++id',
});

// Unique per-series episode index: a raced import must never duplicate
// episodes either.
db.version(4).stores({
  series: '++id, &slug, source, spoilerHidden, addedAt',
  episodes: '++id, seriesId, &[seriesId+index]',
  cues: '++id, episodeId, start',
  clips: '++id, episodeId, seriesId, order',
  words: '++id, lemma, reading, createdAt, clipId',
  cards: '++id, wordId, due, state',
  reviews: '++id, wordId, reviewedAt',
  settings: '++id',
});

export async function getSettings(): Promise<AppSettings> {
  const existing = await db.settings.toCollection().first();
  if (!existing) {
    const id = await db.settings.add({ ...DEFAULT_SETTINGS } as AppSettings);
    return { ...DEFAULT_SETTINGS, id };
  }
  return { ...DEFAULT_SETTINGS, ...existing };
}

export async function updateSettings(patch: Partial<AppSettings>): Promise<void> {
  const current = await getSettings();
  await db.settings.update(current.id!, patch);
}

export async function clearAllData(): Promise<void> {
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
  const root = await mediaRoot();
  for await (const entry of (root as any).values()) {
    if (entry.kind === 'directory') await entry.removeRecursively();
  }
  for (const url of urlCache.values()) URL.revokeObjectURL(url);
  urlCache.clear();
}

let mediaRootHandle: FileSystemDirectoryHandle | null = null;

export async function mediaRoot(): Promise<FileSystemDirectoryHandle> {
  if (mediaRootHandle) return mediaRootHandle;
  const root = await navigator.storage.getDirectory();
  const dir = await root.getDirectoryHandle('anaru-media', { create: true });
  mediaRootHandle = dir;
  return dir;
}

export async function writeMediaFile(path: string, blob: Blob): Promise<void> {
  const root = await mediaRoot();
  const parts = path.split('/');
  const name = parts.pop()!;
  let dir = root;
  for (const segment of parts) {
    dir = await dir.getDirectoryHandle(segment, { create: true });
  }
  const file = await dir.getFileHandle(name, { create: true });
  const writable = await file.createWritable();
  await writable.write(blob);
  await writable.close();
}

export async function readMediaFile(path: string): Promise<File | null> {
  try {
    const root = await mediaRoot();
    const parts = path.split('/');
    const name = parts.pop()!;
    let dir = root;
    for (const segment of parts) {
      dir = await dir.getDirectoryHandle(segment);
    }
    const handle = await dir.getFileHandle(name);
    return await handle.getFile();
  } catch {
    return null;
  }
}

export async function deleteMediaFile(path: string): Promise<void> {
  try {
    const root = await mediaRoot();
    const parts = path.split('/');
    const name = parts.pop()!;
    let dir = root;
    for (const segment of parts) {
      dir = await dir.getDirectoryHandle(segment);
    }
    await dir.removeEntry(name);
  } catch {
    /* already gone */
  }
}

const urlCache = new Map<string, string>();

export async function mediaUrl(path: string): Promise<string | null> {
  const cached = urlCache.get(path);
  if (cached) return cached;
  const file = await readMediaFile(path);
  if (!file) return null;
  const url = URL.createObjectURL(file);
  urlCache.set(path, url);
  return url;
}

export async function mediaExists(path: string): Promise<boolean> {
  return (await readMediaFile(path)) !== null;
}
