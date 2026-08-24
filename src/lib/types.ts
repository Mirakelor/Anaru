export type SubtitleMode = 0 | 1 | 2 | 3 | 4;

export const SUBTITLE_MODES = [
  { id: 0, name: 'Romaji only', hint: 'Day one: just the sounds' },
  { id: 1, name: 'Japanese + romaji', hint: 'Kana and kanji with reading aid' },
  { id: 2, name: 'Japanese', hint: 'Furigana on every kanji' },
  { id: 3, name: 'Japanese + English', hint: 'Full bilingual subtitles' },
  { id: 4, name: 'No subtitles', hint: 'Video only — trust your ears' },
] as const;

export interface Series {
  id?: number;
  slug: string;
  title: string;
  posterPath: string | null;
  spoilerHidden: boolean;
  source: 'pack' | 'user';
  addedAt: number;
}

export interface Episode {
  id?: number;
  seriesId: number;
  index: number;
  title: string;
  videoPath: string;
  videoUrl: string | null;
  duration: number;
  addedAt: number;
}

export interface Cue {
  id?: number;
  episodeId: number;
  start: number;
  end: number;
  text: string;
  translation: string;
}

export interface Clip {
  id?: number;
  episodeId: number;
  seriesId: number;
  start: number;
  end: number;
  order: number;
}

export interface Word {
  id?: number;
  lemma: string;
  reading: string;
  gloss: string;
  pos: string;
  jlpt: number | null;
  surface: string;
  clipId: number | null;
  episodeId: number | null;
  sceneStart: number | null;
  sceneEnd: number | null;
  sentence: string;
  sentenceTranslation: string;
  createdAt: number;
}

export interface CardState {
  id?: number;
  wordId: number;
  due: string;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  reps: number;
  lapses: number;
  state: number;
  learning_steps: number;
  last_review?: string;
}

export interface ReviewLog {
  id?: number;
  wordId: number;
  rating: number;
  due: string;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  state: number;
  reviewedAt: number;
}

export interface AppSettings {
  id?: number;
  subtitleMode: SubtitleMode;
  playbackRate: number;
  autoReplay: boolean;
  listeningCards: boolean;
  shufflePlayback: boolean;
  wordTts: boolean;
  diagnostics: boolean;
  themeId: string;
  onboarded: boolean;
}

export const DEFAULT_SETTINGS: Omit<AppSettings, 'id'> = {
  subtitleMode: 2,
  playbackRate: 1,
  autoReplay: true,
  listeningCards: true,
  shufflePlayback: true,
  wordTts: false,
  diagnostics: false,
  themeId: 'ink',
  onboarded: false,
};
