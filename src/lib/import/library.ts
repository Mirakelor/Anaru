import { db, writeMediaFile, mediaExists } from '../db';
import { parseSubtitles } from '../subtitles/parse';
import { segmentCues } from '../subtitles/segment';
import { fetchText } from '../net';
import type { Clip, Cue, Episode, Series } from '../types';

export interface EpisodeImport {
  index: number;
  title: string;
  video: Blob;
  subtitleName: string;
  subtitleText: string;
}

export interface EpisodeResult {
  episodeId: number;
  cueCount: number;
  clipCount: number;
}

export async function probeDuration(blob: Blob): Promise<number> {
  const url = URL.createObjectURL(blob);
  try {
    return await new Promise<number>((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      const finish = (value: number) => {
        URL.revokeObjectURL(url);
        resolve(value);
      };
      video.onloadedmetadata = () => finish(Number.isFinite(video.duration) ? video.duration : 0);
      video.onerror = () => finish(0);
      video.src = url;
    });
  } catch {
    URL.revokeObjectURL(url);
    return 0;
  }
}

export function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .normalize('NFKC')
      .replace(/[^\p{L}\p{N}]+/gu, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'series'
  );
}

export async function createSeries(input: {
  title: string;
  source: 'pack' | 'user';
  posterPath?: string | null;
  slug?: string;
}): Promise<Series> {
  const slug = input.slug ?? slugify(input.title);
  const existing = await db.series.where('slug').equals(slug).first();
  if (existing) return existing;
  const series: Series = {
    slug,
    title: input.title,
    posterPath: input.posterPath ?? null,
    spoilerHidden: false,
    source: input.source,
    addedAt: Date.now(),
  };
  try {
    const id = await db.series.add(series as Series);
    return { ...series, id };
  } catch {
    // A concurrent import (onboarding + library auto-import) inserted the
    // same slug first; the unique index rejected ours — return theirs.
    const winner = await db.series.where('slug').equals(slug).first();
    if (winner) return winner;
    throw new Error(`Could not create series "${input.title}".`);
  }
}

export async function importEpisode(
  series: Series,
  input: EpisodeImport,
  onProgress?: (stage: string) => void,
): Promise<EpisodeResult> {
  const videoPath = `${series.slug}/e${input.index}.mp4`;
  if (!(await mediaExists(videoPath))) {
    onProgress?.('Copying video…');
    await writeMediaFile(videoPath, input.video);
  }
  onProgress?.('Reading subtitles…');
  const rawCues = parseSubtitles(input.subtitleName, input.subtitleText);
  if (rawCues.length === 0) {
    throw new Error('No usable subtitle lines were found in that file.');
  }
  const duration = await probeDuration(input.video);
  const episode: Episode = {
    seriesId: series.id!,
    index: input.index,
    title: input.title || `Episode ${input.index}`,
    videoPath,
    videoUrl: null,
    duration,
    addedAt: Date.now(),
  };
  const episodeId = (await db.episodes.add(episode as Episode))!;

  onProgress?.('Building clips…');
  const cues: Cue[] = rawCues.map((c) => ({
    episodeId,
    start: c.start,
    end: c.end,
    text: c.text,
    translation: '',
  }));
  await db.cues.bulkAdd(cues as Cue[]);

  const segments = segmentCues(rawCues);
  const clips: Clip[] = segments.map((segment, order) => ({
    episodeId,
    seriesId: series.id!,
    start: segment.start,
    end: duration > 0 ? Math.min(segment.end, duration) : segment.end,
    order,
  }));
  await db.clips.bulkAdd(clips as Clip[]);

  return { episodeId, cueCount: cues.length, clipCount: clips.length };
}

/** Attach translations from a parallel subtitle track (matched by start time). */
export async function attachTranslations(episodeId: number, translationCues: { start: number; text: string }[]): Promise<void> {
  const cues = await db.cues.where('episodeId').equals(episodeId).toArray();
  const byStart = new Map(translationCues.map((c) => [Math.round(c.start * 10) / 10, c.text]));
  const updates: { key: number; changes: { translation: string } }[] = [];
  for (const cue of cues) {
    const key = Math.round(cue.start * 10) / 10;
    const text = byStart.get(key);
    if (text) updates.push({ key: cue.id!, changes: { translation: text } });
  }
  if (updates.length > 0) await db.cues.bulkUpdate(updates);
}

export async function cuesForClip(clip: Clip): Promise<Cue[]> {
  return db.cues
    .where('episodeId')
    .equals(clip.episodeId)
    .filter((cue) => cue.start >= clip.start - 0.2 && cue.start < clip.end)
    .toArray();
}

export async function probeDurationUrl(url: string): Promise<number> {
  // Android WebView can black-screen when many <video> probes are created in
  // a row during pack import. Durations only refine clip ends (the subtitle
  // segments already bound them), so skip probing there. (Detected via the
  // Capacitor API — the Android WebView's UA is overridden for Edge TTS.)
  const isCapacitorAndroid =
    typeof window !== 'undefined' &&
    (window as unknown as { Capacitor?: { getPlatform?: () => string } }).Capacitor?.getPlatform?.() === 'android';
  if (isCapacitorAndroid) return 0;
  return new Promise<number>((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    const timer = setTimeout(() => resolve(0), 8000);
    video.onloadedmetadata = () => {
      clearTimeout(timer);
      resolve(Number.isFinite(video.duration) ? video.duration : 0);
    };
    video.onerror = () => {
      clearTimeout(timer);
      resolve(0);
    };
    video.src = url;
  });
}

export interface RemoteEpisodeImport {
  index: number;
  title: string;
  videoUrl: string;
  subtitleName: string;
  subtitleText: string;
  translationText?: string | null;
}

export async function importRemoteEpisode(
  series: Series,
  input: RemoteEpisodeImport,
  onProgress?: (stage: string) => void,
  knownDuration?: number,
): Promise<EpisodeResult> {
  onProgress?.('Reading subtitles…');
  const rawCues = parseSubtitles(input.subtitleName, input.subtitleText);
  if (rawCues.length === 0) {
    throw new Error('No usable subtitle lines were found in that file.');
  }
  const duration = knownDuration ?? (await probeDurationUrl(input.videoUrl));
  const episode: Episode = {
    seriesId: series.id!,
    index: input.index,
    title: input.title || `Episode ${input.index}`,
    videoPath: '',
    videoUrl: input.videoUrl,
    duration,
    addedAt: Date.now(),
  };
  const episodeId = (await db.episodes.add(episode as Episode))!;

  onProgress?.('Building clips…');
  const cues: Cue[] = rawCues.map((c) => ({
    episodeId,
    start: c.start,
    end: c.end,
    text: c.text,
    translation: '',
  }));
  await db.cues.bulkAdd(cues as Cue[]);
  if (input.translationText) {
    const translationCues = parseSubtitles('translation.srt', input.translationText);
    await attachTranslations(
      episodeId,
      translationCues.map((c) => ({ start: c.start, text: c.text })),
    );
  }

  const segments = segmentCues(rawCues);
  const clips: Clip[] = segments.map((segment, order) => ({
    episodeId,
    seriesId: series.id!,
    start: segment.start,
    end: duration > 0 ? Math.min(segment.end, duration) : segment.end,
    order,
  }));
  await db.clips.bulkAdd(clips as Clip[]);

  return { episodeId, cueCount: cues.length, clipCount: clips.length };
}

export interface PackEpisode {
  index: number;
  title?: string;
  video: string;
  subtitle: string;
  translation?: string | null;
}

export interface PackSeries {
  slug?: string;
  title: string;
  poster?: string | null;
  episodes: PackEpisode[];
}

export interface PackManifest {
  version: number;
  series: PackSeries[];
}

function resolveAgainst(base: string, href: string): string {
  return new URL(href, base).toString();
}

/** Ingest a content pack manifest: streams videos from the pack server. */
let importInFlight: Promise<number> | null = null;
let importUrl: string | null = null;

export async function ingestPack(
  manifestUrl: string,
  onProgress?: (stage: string) => void,
  signal?: AbortSignal,
): Promise<number> {
  // One import at a time: onboarding and the library auto-import can both
  // fire (often for the SAME starter pack URL), and concurrent runs raced on
  // IndexedDB writes (Dexie crashed with a null transaction and episodes got
  // duplicated). A queued request for the same URL reuses the running import;
  // a different URL waits for the lock, then imports its own pack — never
  // silently resolve with the wrong pack's result.
  const previous = importInFlight;
  if (previous) {
    if (importUrl === manifestUrl) return previous;
    await previous.catch(() => undefined);
    return ingestPack(manifestUrl, onProgress, signal);
  }
  importUrl = manifestUrl;
  importInFlight = (async () => {
    return ingestPackInner(manifestUrl, onProgress, signal);
  })().finally(() => {
    importInFlight = null;
    importUrl = null;
  });
  return importInFlight;
}

async function ingestPackInner(
  manifestUrl: string,
  onProgress?: (stage: string) => void,
  signal?: AbortSignal,
): Promise<number> {
  let manifest: PackManifest;
  try {
    manifest = JSON.parse(await fetchText(manifestUrl, signal)) as PackManifest;
  } catch (err) {
    if (err instanceof SyntaxError) throw new Error('That URL is not a valid content pack.');
    throw err;
  }
  if (!manifest || !Array.isArray(manifest.series)) throw new Error('That URL is not a valid content pack.');

  // Phase 1: download every subtitle track first. Nothing is written to the
  // database until the whole pack is fetched, so a failed load never leaves
  // half-imported series behind. Downloads run with a small concurrency cap.
  type Fetched = {
    series: PackSeries;
    episode: PackEpisode;
    subtitleText: string;
    translationText: string | null;
    duration: number;
  };
  const tasks: { series: PackSeries; episode: PackEpisode }[] = [];
  for (const packSeries of manifest.series) {
    for (const packEpisode of packSeries.episodes) {
      tasks.push({ series: packSeries, episode: packEpisode });
    }
  }
  const fetched = new Array<Fetched>(tasks.length);
  let next = 0;
  const worker = async () => {
    while (next < tasks.length) {
      const idx = next++;
      const { series: packSeries, episode: packEpisode } = tasks[idx];
      onProgress?.(`${packSeries.title} — episode ${packEpisode.index}…`);
      const subtitleText = await fetchText(resolveAgainst(manifestUrl, packEpisode.subtitle), signal);
      let translationText: string | null = null;
      if (packEpisode.translation) {
        try {
          translationText = await fetchText(resolveAgainst(manifestUrl, packEpisode.translation), signal);
        } catch {
          translationText = null;
        }
      }
      const duration = await probeDurationUrl(resolveAgainst(manifestUrl, packEpisode.video));
      fetched[idx] = { series: packSeries, episode: packEpisode, subtitleText, translationText, duration };
    }
  };
  await Promise.all(Array.from({ length: Math.min(3, tasks.length) }, () => worker()));

  // Phase 2: everything is downloaded — now write to the database.
  let clips = 0;
  let skipped = 0;
  const created = new Map<string, Series>();
  for (const { series: packSeries, episode: packEpisode, subtitleText, translationText, duration } of fetched) {
    const key = packSeries.slug ?? packSeries.title;
    let series = created.get(key);
    if (!series) {
      series = await createSeries({
        title: packSeries.title,
        slug: packSeries.slug,
        source: 'pack',
        posterPath: packSeries.poster ? resolveAgainst(manifestUrl, packSeries.poster) : null,
      });
      created.set(key, series);
    }
    try {
      const result = await importRemoteEpisode(
        series,
        {
          index: packEpisode.index,
          title: packEpisode.title ?? `Episode ${packEpisode.index}`,
          videoUrl: resolveAgainst(manifestUrl, packEpisode.video),
          subtitleName: packEpisode.subtitle.split('/').pop() ?? 'subtitles.srt',
          subtitleText,
          translationText,
        },
        undefined,
        duration,
      );
      clips += result.clipCount;
    } catch (err) {
      // One bad episode must not zero out the whole pack: skip it and keep
      // importing the rest, so the series never appears with 0 clips.
      skipped += 1;
      onProgress?.(`Skipped ${packSeries.title} — episode ${packEpisode.index} (${err instanceof Error ? err.message : 'error'})`);
    }
  }
  if (skipped > 0 && clips === 0) {
    throw new Error(`No episodes could be imported (${skipped} skipped). Check the pack's subtitles and video codecs.`);
  }
  return clips;
}
