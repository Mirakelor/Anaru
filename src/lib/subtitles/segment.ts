import type { SubtitleCue } from './parse';

export interface Segment {
  start: number;
  end: number;
  cueIndices: number[];
}

export interface SegmentOptions {
  /** Maximum gap between lines that still belong to one moment. */
  mergeGap: number;
  /** Hard cap on a clip's length. */
  maxClipLength: number;
  /** Padding added before the first line of a clip. */
  preRoll: number;
  /** Padding added after the last line of a clip. */
  postRoll: number;
  /** Lines shorter than this many characters are skipped as noise. */
  minLineChars: number;
}

export const DEFAULT_SEGMENT_OPTIONS: SegmentOptions = {
  mergeGap: 0.9,
  maxClipLength: 16,
  preRoll: 0.35,
  postRoll: 0.7,
  minLineChars: 1,
};

/**
 * Group subtitle cues into short "moments" suitable for a vertical feed:
 * consecutive lines with small gaps merge into one clip; long stretches are
 * split at the largest internal gaps so no clip exceeds maxClipLength.
 */
export function segmentCues(cues: SubtitleCue[], opts: Partial<SegmentOptions> = {}): Segment[] {
  const o = { ...DEFAULT_SEGMENT_OPTIONS, ...opts };
  const usable = cues.map((c, i) => ({ ...c, i })).filter((c) => c.text.replace(/\s/g, '').length >= o.minLineChars);
  if (usable.length === 0) return [];

  const groups: { start: number; end: number; cueIndices: number[] }[] = [];
  let current: { start: number; end: number; cueIndices: number[] } | null = null;

  for (const cue of usable) {
    if (current && cue.start - current.end <= o.mergeGap && cue.end - current.start <= o.maxClipLength) {
      current.end = Math.max(current.end, cue.end);
      current.cueIndices.push(cue.i);
    } else {
      if (current) groups.push(current);
      current = { start: cue.start, end: cue.end, cueIndices: [cue.i] };
    }
  }
  if (current) groups.push(current);

  const segments: Segment[] = [];
  for (const group of groups) {
    if (group.end - group.start <= o.maxClipLength) {
      segments.push({
        start: Math.max(0, group.start - o.preRoll),
        end: group.end + o.postRoll,
        cueIndices: group.cueIndices,
      });
      continue;
    }
    const groupCues = group.cueIndices.map((i) => cues[i]);
    const gaps = groupCues.slice(1).map((c, k) => ({ gap: c.start - groupCues[k].end, after: k }));
    gaps.sort((a, b) => b.gap - a.gap);
    const splitPoints = gaps
      .slice(0, Math.ceil((group.end - group.start) / o.maxClipLength) - 1)
      .filter((g) => g.gap > 0)
      .map((g) => g.after + 1)
      .sort((a, b) => a - b);

    let cursor = 0;
    for (const point of [...splitPoints, groupCues.length]) {
      const part = groupCues.slice(cursor, point);
      if (part.length > 0) {
        segments.push({
          start: Math.max(0, part[0].start - o.preRoll),
          end: part[part.length - 1].end + o.postRoll,
          cueIndices: part.map((c) => (c as SubtitleCue & { i: number }).i),
        });
      }
      cursor = point;
    }
  }

  segments.sort((a, b) => a.start - b.start);
  return segments;
}
