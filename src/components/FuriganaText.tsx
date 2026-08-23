import { useTokenized } from '../lib/nlp/useTokenized';
import type { FuriganaSegment } from '../lib/nlp/tokenize';
import type { Clip, Cue, Episode, Series } from '../lib/types';
import { useApp } from '../state/store';

interface FuriganaTextProps {
  text: string;
  size?: 'overlay' | 'sheet';
  clip?: Clip | null;
  episode?: Episode | null;
  series?: Series | null;
  cue?: Cue | null;
  translation?: string;
}

export function FuriganaText({ text, size = 'overlay', clip, episode, series, cue, translation }: FuriganaTextProps) {
  const line = useTokenized(text);
  const openWordSheet = useApp((s) => s.openWordSheet);

  const onWord = (segment: FuriganaSegment) => {
    openWordSheet({
      surface: segment.text,
      baseForm: segment.baseForm,
      reading: segment.reading,
      sentence: text,
      sentenceTranslation: translation ?? '',
      clip: clip ?? null,
      episode: episode ?? null,
      series: series ?? null,
      cue: cue ?? null,
    });
  };

  // Tokenizer not ready (or failed): keep the line tappable with a light
  // han/kana split so lookup still works on every shell.
  if (!line) {
    const m = text.match(/[\p{Script=Han}]+|[ぁ-んァ-ン]+/u);
    const fallback: FuriganaSegment | null = m
      ? {
          text: m[0],
          parts: [{ text: m[0], ruby: null }],
          tokenIndex: 0,
          baseForm: m[0],
          reading: '',
          isWord: true,
        }
      : null;
    return (
      <span
        className={`furi-plain ${fallback ? 'furi-fallback' : ''}`}
        onClick={
          fallback
            ? (e) => {
                e.stopPropagation();
                onWord(fallback);
              }
            : undefined
        }
        role={fallback ? 'button' : undefined}
      >
        {text}
      </span>
    );
  }

  return (
    <span className={`furi-line furi-${size}`}>
      {line.segments.map((segment, i) =>
        segment.isWord ? (
          <button
            type="button"
            key={i}
            className="furi-word"
            onClick={(e) => {
              e.stopPropagation();
              onWord(segment);
            }}
          >
            {segment.parts.map((part, j) =>
              part.ruby ? (
                <ruby key={j}>
                  {part.text}
                  <rt>{part.ruby}</rt>
                </ruby>
              ) : (
                <span key={j}>{part.text}</span>
              ),
            )}
          </button>
        ) : (
          <span key={i} className="furi-plain">
            {segment.parts.map((part, j) =>
              part.ruby ? (
                <ruby key={j}>
                  {part.text}
                  <rt>{part.ruby}</rt>
                </ruby>
              ) : (
                <span key={j}>{part.text}</span>
              ),
            )}
          </span>
        ),
      )}
    </span>
  );
}
