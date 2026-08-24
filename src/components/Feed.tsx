import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, mediaUrl } from '../lib/db';
import type { AppSettings, Clip, Cue, Episode, Series } from '../lib/types';

import { cuesForClip } from '../lib/import/library';
import { storyOrder } from '../lib/feed';
import { useApp } from '../state/store';
import { FuriganaText } from './FuriganaText';
import { useTokenized } from '../lib/nlp/useTokenized';

const RESUME_KEY = 'anaru-feed-resume';
// Only the current screen and a few neighbours are rendered; the full feed
// (a starter pack is ~1200 clips) would otherwise mount a <video> element and
// a liveQuery per clip, which janks on iPad Safari.
const WINDOW = 3;

function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function readResume(): { clipId: number; time: number } | null {
  try {
    const raw = localStorage.getItem(RESUME_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as { clipId?: unknown; time?: unknown };
    if (typeof v?.clipId === 'number' && typeof v?.time === 'number') {
      return { clipId: v.clipId, time: v.time };
    }
  } catch {
    /* storage unavailable */
  }
  return null;
}

export function FeedPage() {
  const filter = useApp((s) => s.feedSeriesFilter);
  const series = useLiveQuery(() => db.series.toArray(), []);
  const episodes = useLiveQuery(() => db.episodes.toArray(), []);
  const settings = useLiveQuery(() => db.settings.toCollection().first(), []);
  const clips = useLiveQuery(async () => {
    const hidden = new Set((await db.series.filter((s) => s.spoilerHidden).toArray()).map((s) => s.id));
    const all = await db.clips.toArray();
    return all.filter((c) => (filter ? c.seriesId === filter : !hidden.has(c.seriesId)));
  }, [filter]);

  // Sound state lives at the feed level: the first entry starts muted (to
  // satisfy autoplay policies), but switching clips must not reset it.
  const [soundOn, setSoundOn] = useState(false);
  const [current, setCurrent] = useState(0);
  const [resumeClipId, setResumeClipId] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const resume = useRef(readResume());

  const ordered = useMemo(() => {
    if (!clips) return [];
    if (settings?.shufflePlayback !== false) return shuffle(clips);
    return storyOrder(clips, episodes ?? [], series ?? []);
  }, [clips, episodes, series, settings?.shufflePlayback]);
  const story = settings?.shufflePlayback === false;

  // Story mode remembers the last clip; jump back to it when the feed opens.
  useEffect(() => {
    if (!story || resumeClipId !== null || ordered.length === 0) return;
    const r = resume.current;
    if (!r) return;
    const idx = ordered.findIndex((c) => c.id === r.clipId);
    if (idx === -1) return;
    setResumeClipId(r.clipId);
    setCurrent(idx);
    const container = containerRef.current;
    if (container) container.scrollTop = idx * container.clientHeight;
  }, [story, resumeClipId, ordered]);

  const onScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container || container.clientHeight === 0) return;
    const idx = Math.round(container.scrollTop / container.clientHeight);
    setCurrent(Math.max(0, Math.min(ordered.length - 1, idx)));
  }, [ordered.length]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.addEventListener('scroll', onScroll, { passive: true });
    return () => container.removeEventListener('scroll', onScroll);
  }, [onScroll]);

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

  const start = Math.max(0, current - WINDOW);
  const end = Math.min(ordered.length, current + WINDOW + 1);
  const seriesById = new Map(series.map((s) => [s.id, s]));

  return (
    <div className="feed" ref={containerRef}>
      <div style={{ height: `${ordered.length * 100}vh` }}>
        {ordered.slice(start, end).map((clip, i) => {
          const idx = start + i;
          return (
            <div
              key={clip.id}
              className="feed-slot"
              style={{ top: `${idx * 100}vh` }}
            >
              <FeedClip
                clip={clip}
                index={idx}
                active={idx === current}
                soundOn={soundOn}
                onSoundChange={setSoundOn}
                series={seriesById.get(clip.seriesId) ?? null}
                settings={settings}
                resumeTime={resumeClipId === clip.id ? (resume.current?.time ?? undefined) : undefined}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface FeedClipProps {
  clip: Clip;
  index: number;
  active: boolean;
  soundOn: boolean;
  onSoundChange: (on: boolean) => void;
  series: Series | null;
  settings: AppSettings | undefined;
  resumeTime?: number;
}

function FeedClip({ clip, index, active, soundOn, onSoundChange, series, settings, resumeTime }: FeedClipProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [cues, setCues] = useState<Cue[] | null>(null);
  const [time, setTime] = useState(clip.start);
  const [paused, setPaused] = useState(false);
  const [ready, setReady] = useState(false);
  // On Android the playing video renders on a native surface that covers all
  // DOM below it (tab bar included) — keep the video box above the tab bar.
  const androidVideoSpace =
    typeof window !== 'undefined' &&
    (window as unknown as { Capacitor?: { getPlatform?: () => string } }).Capacitor?.getPlatform?.() === 'android';

  const episode = useLiveQuery(() => (active ? db.episodes.get(clip.episodeId) : undefined), [clip.episodeId, active]);
  const wordSheet = useApp((s) => s.wordSheet);
  const story = settings?.shufflePlayback === false;
  const lastSaveRef = useRef(0);

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
      const startAt =
        resumeTime && resumeTime > clip.start && resumeTime < clip.end - 1 ? resumeTime : clip.start;
      if (Math.abs(video.currentTime - startAt) > 0.3 || video.ended) {
        video.currentTime = startAt;
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
  }, [active, src, clip.start, clip.end, resumeTime, settings?.playbackRate]);

  useEffect(() => {
    setReady(false);
  }, [src]);

  // Story mode: keep the feed's position (throttled) so it resumes where the
  // user left off. A clip never auto-advances — playback stops at its end.
  const saveResume = useCallback((clipId: number, t: number) => {
    const now = Date.now();
    if (now - lastSaveRef.current < 3000) return;
    lastSaveRef.current = now;
    try {
      localStorage.setItem(RESUME_KEY, JSON.stringify({ clipId, time: Math.max(0, t) }));
    } catch {
      /* storage unavailable */
    }
  }, []);

  const onTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const t = video.currentTime;
    setTime(t);
    if (story) {
      if (clip.id !== undefined) saveResume(clip.id, t);
    }
    if (t >= clip.end - 0.03) {
      if (settings?.autoReplay ?? true) {
        video.currentTime = clip.start;
      } else {
        video.pause();
        setPaused(true);
      }
    }
  }, [clip, story, saveResume, settings?.autoReplay]);

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
      <div className={`feed-video-wrap ${androidVideoSpace ? 'android-video-space' : ''}`} onClick={togglePause}>
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
        {activeCue && <SubtitleBlock cue={activeCue} clip={clip} episode={episode ?? null} series={series} showRomaji={showRomaji} showJapanese={showJapanese} showEnglish={showEnglish} />}
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
  return (
    // Taps anywhere on the line must not fall through to the pause handler;
    // each word button (tokenized or fallback) opens its own lookup.
    <div className="subtitle-block" onClick={(e) => e.stopPropagation()}>
      {showRomaji && (
        <p className="subtitle-romaji">{line ? line.romaji : ''}</p>
      )}
      {showJapanese && (
        <p className="subtitle-jp">
          <FuriganaText text={cue.text} clip={clip} episode={episode} series={series} cue={cue} translation={cue.translation} />
        </p>
      )}
      {showEnglish && cue.translation && <p className="subtitle-en">{cue.translation}</p>}
    </div>
  );
}
