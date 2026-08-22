import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, mediaUrl } from '../lib/db';
import { dueItems, previewIntervals, reviewCard, type DueItem, type Grade } from '../lib/srs/engine';
import { useApp } from '../state/store';
import { FuriganaText } from '../components/FuriganaText';

export function ReviewPage() {
  const setDueCount = useApp((s) => s.setDueCount);
  const [items, setItems] = useState<DueItem[] | null>(null);
  const [position, setPosition] = useState(0);
  const [finished, setFinished] = useState(0);

  const due = useLiveQuery(() => dueItems(), []);

  useEffect(() => {
    if (due) setDueCount(due.length);
  }, [due, setDueCount]);

  useEffect(() => {
    if (due && items === null && due.length > 0) {
      setItems(due);
    }
  }, [due, items]);

  const current = items?.[position] ?? null;

  const onGraded = async (grade: Grade) => {
    if (!current) return;
    await reviewCard(current.card, grade);
    setFinished((f) => f + 1);
    if (position + 1 >= (items?.length ?? 0)) {
      setItems(null);
      setPosition(0);
    } else {
      setPosition((p) => p + 1);
    }
  };

  if (!due) return <div className="page-loading" />;

  if (due.length === 0 && !current) {
    return (
      <div className="review-empty">
        <div className="review-empty-glyph">🌙</div>
        <p className="review-empty-title">All caught up</p>
        <p className="review-empty-sub">
          {finished > 0
            ? `Nice — ${finished} review${finished === 1 ? '' : 's'} done. New cards appear as words come due.`
            : 'Save words from the feed and they will show up here when they are due.'}
        </p>
      </div>
    );
  }

  if (!current) return <div className="page-loading" />;

  return <ReviewSession key={`${current.card.id}-${position}`} item={current} remaining={(items?.length ?? 0) - position} onGraded={onGraded} />;
}

interface ReviewSessionProps {
  item: DueItem;
  remaining: number;
  onGraded: (grade: Grade) => void;
}

function ReviewSession({ item, remaining, onGraded }: ReviewSessionProps) {
  const settings = useLiveQuery(() => db.settings.toCollection().first(), []);
  const [revealed, setRevealed] = useState(false);
  const listening = useMemo(
    () => Boolean(settings?.listeningCards) && Math.random() < 0.35 && item.word.sceneStart !== null,
    [settings?.listeningCards, item.word.sceneStart],
  );
  const previews = useMemo(() => previewIntervals(item.card), [item.card]);

  return (
    <div className="review">
      <div className="review-progress">
        <span>{remaining} left</span>
      </div>

      <div className="review-card">
        {item.word.sceneStart !== null && (
          <SceneVideo
            episodeId={item.word.episodeId}
            start={item.word.sceneStart}
            end={item.word.sceneEnd}
          />
        )}

        <div className="review-front">
          {listening && !revealed ? (
            <p className="review-hint">Listen and recall the word</p>
          ) : (
            <p className="review-word">
              <FuriganaText text={item.word.lemma} size="sheet" />
            </p>
          )}
          <p className="review-sentence">
            <FuriganaText text={item.word.sentence} size="sheet" />
          </p>
          {listening && !revealed && <p className="review-reading-hidden">{item.word.reading}</p>}
        </div>

        {revealed ? (
          <div className="review-answer">
            <p className="review-reading">
              {item.word.reading}
              {item.word.jlpt && <span className={`jlpt-badge n${item.word.jlpt}`}>N{item.word.jlpt}</span>}
            </p>
            <p className="review-gloss">{item.word.gloss || 'No definition saved'}</p>
            {item.word.sentenceTranslation && <p className="review-translation">{item.word.sentenceTranslation}</p>}
            <div className="review-grades">
              {previews.map((preview) => (
                <button
                  key={preview.grade}
                  type="button"
                  className={`grade grade-${preview.grade}`}
                  onClick={() => onGraded(preview.grade)}
                >
                  <span className="grade-label">{preview.grade}</span>
                  <span className="grade-interval">{preview.intervalLabel}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <button type="button" className="btn btn-primary review-reveal" onClick={() => setRevealed(true)}>
            Show answer
          </button>
        )}
      </div>
    </div>
  );
}

interface SceneVideoProps {
  episodeId: number | null;
  start: number | null;
  end: number | null;
}

function SceneVideo({ episodeId, start, end }: SceneVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    if (episodeId === null) return;
    let cancelled = false;
    db.episodes.get(episodeId).then((episode) => {
      if (!episode) return;
      if (episode.videoUrl) {
        if (!cancelled) setSrc(episode.videoUrl);
      } else {
        mediaUrl(episode.videoPath).then((url) => !cancelled && setSrc(url));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [episodeId]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src || start === null) return;
    video.currentTime = start;
    video.play().catch(() => undefined);
  }, [src, start]);

  if (!src || start === null) return null;

  return (
    <div className="review-scene">
      <video
        ref={videoRef}
        src={src}
        muted
        loop
        playsInline
        onTimeUpdate={() => {
          const video = videoRef.current;
          if (video && end !== null && video.currentTime >= end) {
            video.currentTime = start;
          }
        }}
      />
    </div>
  );
}
