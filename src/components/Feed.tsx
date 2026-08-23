import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, mediaUrl } from '../lib/db';
import type { Clip, Cue, Episode, Series } from '../lib/types';
import type { FuriganaSegment } from '../lib/nlp/tokenize';
import { cuesForClip } from '../lib/import/library';
import { useApp } from '../state/store';
import { FuriganaText } from './FuriganaText';
import { useTokenized } from '../lib/nlp/useTokenized';

function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function FeedPage() {
  const filter = useApp((s) => s.feedSeriesFilter);
  const series = useLiveQuery(() => db.series.toArray(), []);
  const settings = useLiveQuery(() => db.settings.toCollection().first(), []);
  const clips = useLiveQuery(async () => {
    const hidden = new Set((await db.series.filter((s) => s.spoilerHidden).toArray()).map((s) => s.id));
    const all = await db.clips.toArray();
    return all.filter((c) => (filter ? c.seriesId === filter : !hidden.has(c.seriesId)));
  }, [filter]);

  // Sound state lives at the feed level: the first entry starts muted (to
  // satisfy autoplay policies), but switching clips must not reset it.
  const [soundOn, setSoundOn] = useState(false);

  const ordered = useMemo(() => {
    if (!clips) return [];
    return settings?.shufflePlayback !== false ? shuffle(clips) : [...clips].sort((a, b) => a.order - b.order);
  }, [clips, settings?.shufflePlayback]);
  const [current, setCurrent] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setCurrent(Number((entry.target as HTMLElement).dataset.index));
          }
        }
      },
      { root: container, threshold: 0.6 },
    );
    container.querySelectorAll('[data-index]').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [ordered.length]);

  if (!series || !clips) return <div className="page-loading" />;

  if (ordered.length === 0) {
    return (
      <div className="feed-empty">
        <p className="feed-empty-title">Nothing to watch yet</p>
        <p className="feed-empty-sub">
          Every series you add becomes a feed of short scenes. Import your own anime from the Library, or load a
          content pack.
        </p>
      </div>
    );
  }

  return (
    <div className="feed" ref={containerRef}>
      {ordered.map((clip, i) => (
        <FeedClip key={clip.id} clip={clip} index={i} active={i === current} soundOn={soundOn} onSoundChange={setSoundOn} />
      ))}
    </div>
  );
}

interface FeedClipProps {
  clip: Clip;
  index: number;
  active: boolean;
  soundOn: boolean;
  onSoundChange: (on: boolean) => void;
}

function FeedClip({ clip, index, active, soundOn, onSoundChange }: FeedClipProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [cues, setCues] = useState<Cue[] | null>(null);
  const [time, setTime] = useState(clip.start);
  const [paused, setPaused] = useState(false);
  const [ready, setReady] = useState(false);

  const episode = useLiveQuery(() => (active ? db.episodes.get(clip.episodeId) : undefined), [clip.episodeId, active]);
  const series = useLiveQuery(() => db.series.get(clip.seriesId), [clip.seriesId]);
  const settings = useLiveQuery(() => db.settings.toCollection().first(), []);
  const wordSheet = useApp((s) => s.wordSheet);

  // Pause while the word sheet is open, resume when it closes (TTS reads the
  // word out loud during the lookup, so the scene audio must stop).
  const wasPlayingRef = useRef(false);
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;
    if (wordSheet) {
      wasPlayingRef.current = !video.paused;
      video.pause();
    } else if (wasPlayingRef.current) {
      wasPlayingRef.current = false;
      video.play().catch(() => undefined);
    }
  }, [wordSheet, src]);

  // Android WebView renders a playing <video> on a native surface above all
  // DOM layers, which would hide the lookup sheet — take the video out of the
  // render tree while the sheet is open (state is kept, playback resumes).
  const videoHidden = wordSheet !== null;

  useEffect(() => {
    if (!active) {
      setSrc(null);
      setCues(null);
      setReady(false);
      return;
    }
    let cancelled = false;
    db.episodes.get(clip.episodeId).then((ep) => {
      if (!ep || cancelled) return;
      if (ep.videoUrl) {
        if (!cancelled) setSrc(ep.videoUrl);
      } else {
        mediaUrl(ep.videoPath).then((url) => !cancelled && setSrc(url));
      }
    });
    cuesForClip(clip).then((result) => !cancelled && setCues(result));
    return () => {
      cancelled = true;
    };
  }, [clip, active]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;
    if (!active) {
      video.pause();
      return;
    }
    const seekAndPlay = () => {
      if (Math.abs(video.currentTime - clip.start) > 0.3 || video.ended) {
        video.currentTime = clip.start;
      }
      video.playbackRate = settings?.playbackRate ?? 1;
      video.play().catch(() => setPaused(true));
      setPaused(false);
    };
    if (video.readyState >= 1) {
      seekAndPlay();
    } else {
      video.addEventListener('loadedmetadata', seekAndPlay, { once: true });
    }
    return () => video.removeEventListener('loadedmetadata', seekAndPlay);
  }, [active, src, clip.start, settings?.playbackRate]);

  useEffect(() => {
    setReady(false);
  }, [src]);

  const onTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const t = video.currentTime;
    setTime(t);
    if (t >= clip.end - 0.03) {
      if (settings?.autoReplay ?? true) {
        video.currentTime = clip.start;
      } else {
        video.pause();
        setPaused(true);
      }
    }
  }, [clip.start, clip.end, settings?.autoReplay]);

  const togglePause = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => undefined);
      setPaused(false);
      onSoundChange(true);
    } else {
      video.pause();
      setPaused(true);
    }
  };

  // Subtitle stays on screen for the whole clip: each clip is one line, so
  // once a cue has started it keeps showing until the clip ends (tap-to-look-up
  // needs the line to stay tappable).
  const activeCue = useMemo(() => {
    if (!cues) return null;
    let last: Cue | null = null;
    for (const cue of cues) {
      if (time >= cue.start) last = cue;
      else break;
    }
    return last;
  }, [cues, time]);
  const mode = settings?.subtitleMode ?? 2;
  const showRomaji = mode === 0 || mode === 1;
  const showJapanese = mode !== 0 && mode !== 4;
  const showEnglish = mode === 3;

  return (
    <div className="feed-item" data-index={index}>
      <div className="feed-video-wrap" onClick={togglePause}>
        {src && (
          <video
            ref={videoRef}
            src={src}
            muted={!soundOn}
            playsInline
            preload="metadata"
            onTimeUpdate={onTimeUpdate}
            onCanPlay={() => setReady(true)}
            onLoadedData={() => setReady(true)}
            style={videoHidden ? { display: 'none' } : undefined}
          />
        )}
        {active && !ready && (
          <div className="feed-item-loading">
            <span className="feed-loading-spinner" />
            <span className="feed-loading-label">Loading…</span>
          </div>
        )}
        {paused && (
          <button type="button" className="feed-play-badge" aria-label="Play">
            <svg viewBox="0 0 24 24" width="34" height="34" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          </button>
        )}
      </div>

      <div className="feed-top">
        <span className="feed-series">{series?.title ?? '…'}</span>
        <span className="feed-episode">{episode?.title ?? ''}</span>
      </div>

      <button
        type="button"
        className={`feed-sound ${soundOn ? 'on' : ''}`}
        onClick={(e) => {
          e.stopPropagation();
          onSoundChange(!soundOn);
        }}
        aria-label={soundOn ? 'Mute' : 'Unmute'}
      >
        {soundOn ? (
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M3 10v4h4l5 5V5L7 10H3zm13.5 2a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4zM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M3 10v4h4l5 5V5L7 10H3zm18.6 2 2.1-2.1-1.4-1.4-2.1 2.1-2.1-2.1-1.4 1.4 2.1 2.1-2.1 2.1 1.4 1.4 2.1-2.1 2.1 2.1 1.4-1.4-2.1-2.1z" />
          </svg>
        )}
      </button>

      <div className="feed-subtitles" onClick={togglePause}>
        {activeCue && <SubtitleBlock cue={activeCue} clip={clip} episode={episode ?? null} series={series ?? null} showRomaji={showRomaji} showJapanese={showJapanese} showEnglish={showEnglish} />}
      </div>
    </div>
  );
}

interface SubtitleBlockProps {
  cue: Cue;
  clip: Clip;
  episode: Episode | null;
  series: Series | null;
  showRomaji: boolean;
  showJapanese: boolean;
  showEnglish: boolean;
}

function SubtitleBlock({ cue, clip, episode, series, showRomaji, showJapanese, showEnglish }: SubtitleBlockProps) {
  const line = useTokenized(cue.text);
  const openWordSheet = useApp((s) => s.openWordSheet);
  const wordElsRef = useRef<(HTMLElement | null)[]>([]);

  const openFor = (segment: FuriganaSegment | null) => {
    if (!segment) return;
    openWordSheet({
      surface: segment.text,
      baseForm: segment.baseForm,
      reading: segment.reading,
      sentence: cue.text,
      sentenceTranslation: cue.translation ?? '',
      clip: clip ?? null,
      episode: episode ?? null,
      series: series ?? null,
      cue: cue ?? null,
    });
  };

  const lookUpAt = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!line) {
      const m = cue.text.match(/[\p{Script=Han}]+|[ぁ-んァ-ン]+/u);
      openFor(
        m
          ? {
              text: m[0],
              parts: [{ text: m[0], ruby: null }],
              tokenIndex: 0,
              baseForm: m[0],
              reading: '',
              isWord: true,
            }
          : null,
      );
      return;
    }
    const words = line.segments.filter((s) => s.isWord);
    let best = -1;
    let bestDist = Infinity;
    wordElsRef.current.forEach((el, i) => {
      if (!el || !words[i]) return;
      const r = el.getBoundingClientRect();
      const dx = r.left + r.width / 2 - e.clientX;
      const dy = r.top + r.height / 2 - e.clientY;
      const d = dx * dx + dy * dy;
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    });
    openFor(best >= 0 ? words[best] : null);
  };

  return (
    <div className="subtitle-block" onClick={lookUpAt}>
      {showRomaji && (
        <p className="subtitle-romaji">{line ? line.romaji : ''}</p>
      )}
      {showJapanese && (
        <p className="subtitle-jp">
          <FuriganaText
            text={cue.text}
            clip={clip}
            episode={episode}
            series={series}
            cue={cue}
            translation={cue.translation}
            wordRefs={(els) => {
              wordElsRef.current = els;
            }}
          />
        </p>
      )}
      {showEnglish && cue.translation && <p className="subtitle-en">{cue.translation}</p>}
    </div>
  );
}
