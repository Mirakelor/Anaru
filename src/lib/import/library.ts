import { db, writeMediaFile, mediaExists } from '../db';
import { parseSubtitles } from '../subtitles/parse';
import { segmentCues } from '../subtitles/segment';
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
  const id = await db.series.add(series as Series);
  return { ...series, id };
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
export async function ingestPack(
  manifestUrl: string,
  onProgress?: (stage: string) => void,
  signal?: AbortSignal,
): Promise<number> {
  const response = await fetch(manifestUrl, { signal });
  if (!response.ok) throw new Error(`Could not load the pack manifest (${response.status}).`);
  const manifest = (await response.json()) as PackManifest;
  if (!manifest || !Array.isArray(manifest.series)) throw new Error('That URL is not a valid content pack.');

  // Phase 1: download every subtitle track first. Nothing is written to the
  // database until the whole pack is fetched, so a failed load never leaves
  // half-imported series behind.
  type Fetched = {
    series: PackSeries;
    episode: PackEpisode;
    subtitleText: string;
    translationText: string | null;
    duration: number;
  };
  const fetched: Fetched[] = [];
  for (const packSeries of manifest.series) {
    for (const packEpisode of packSeries.episodes) {
      onProgress?.(`${packSeries.title} — episode ${packEpisode.index}…`);
      const subtitleResponse = await fetch(resolveAgainst(manifestUrl, packEpisode.subtitle), { signal });
      if (!subtitleResponse.ok) {
        throw new Error(`Missing subtitles for ${packSeries.title} episode ${packEpisode.index}.`);
      }
      const subtitleText = await subtitleResponse.text();
      let translationText: string | null = null;
      if (packEpisode.translation) {
        const translationResponse = await fetch(resolveAgainst(manifestUrl, packEpisode.translation), { signal });
        if (translationResponse.ok) translationText = await translationResponse.text();
      }
      const duration = await probeDurationUrl(resolveAgainst(manifestUrl, packEpisode.video));
      fetched.push({ series: packSeries, episode: packEpisode, subtitleText, translationText, duration });
    }
  }

  // Phase 2: everything is downloaded — now write to the database.
  let clips = 0;
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
  }
  return clips;
}
