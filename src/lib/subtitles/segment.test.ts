import { describe, expect, it } from 'vitest';
import { segmentCues } from './segment';
import type { SubtitleCue } from './parse';

function cue(start: number, end: number, text = 'セリフ'): SubtitleCue {
  return { start, end, text };
}

describe('segmentCues', () => {
  it('merges adjacent lines into one clip', () => {
    const cues = [cue(1, 2), cue(2.5, 4), cue(4.4, 6)];
    const segments = segmentCues(cues);
    expect(segments).toHaveLength(1);
    expect(segments[0].cueIndices).toEqual([0, 1, 2]);
    expect(segments[0].start).toBeLessThan(1);
    expect(segments[0].end).toBeGreaterThan(6);
  });

  it('splits on large silence gaps', () => {
    const cues = [cue(1, 2), cue(20, 22), cue(40, 41)];
    const segments = segmentCues(cues);
    expect(segments).toHaveLength(3);
  });

  it('splits long stretches at the largest gaps', () => {
    const cues = [
      cue(0, 2),
      cue(2.4, 4),
      cue(9, 11),
      cue(11.4, 13),
      cue(13.4, 15),
      cue(15.4, 17),
    ];
    const segments = segmentCues(cues, { maxClipLength: 12 });
    expect(segments.every((s) => s.end - s.start <= 12 + 1.05 + 1e-9)).toBe(true);
    expect(segments.length).toBeGreaterThanOrEqual(2);
    const allCues = segments.flatMap((s) => s.cueIndices).sort((a, b) => a - b);
    expect(allCues).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('keeps clip order sorted by start time', () => {
    const cues = [cue(30, 31), cue(1, 2), cue(10, 11)];
    const segments = segmentCues(cues);
    expect(segments.map((s) => s.start)).toEqual([...segments.map((s) => s.start)].sort((a, b) => a - b));
  });

  it('drops empty-text cues', () => {
    const cues = [cue(1, 2, ''), cue(3, 4, '  ')];
    expect(segmentCues(cues)).toHaveLength(0);
  });

  it('never starts before zero', () => {
    const segments = segmentCues([cue(0.1, 1)]);
    expect(segments[0].start).toBe(0);
  });
});
