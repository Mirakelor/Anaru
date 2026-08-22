import { create } from 'zustand';
import type { Clip, Cue, Series, Episode } from '../lib/types';

export type Tab = 'feed' | 'library' | 'review' | 'words' | 'stats' | 'settings';

export interface WordSheetState {
  surface: string;
  baseForm: string;
  reading: string;
  sentence: string;
  sentenceTranslation: string;
  clip: Clip | null;
  episode: Episode | null;
  series: Series | null;
  cue: Cue | null;
}

interface AppState {
  tab: Tab;
  setTab: (tab: Tab) => void;
  wordSheet: WordSheetState | null;
  openWordSheet: (state: WordSheetState) => void;
  closeWordSheet: () => void;
  feedSeriesFilter: number | null;
  setFeedSeriesFilter: (seriesId: number | null) => void;
  dueCount: number;
  setDueCount: (count: number) => void;
}

export const useApp = create<AppState>((set) => ({
  tab: 'feed',
  setTab: (tab) => set({ tab }),
  wordSheet: null,
  openWordSheet: (wordSheet) => set({ wordSheet }),
  closeWordSheet: () => set({ wordSheet: null }),
  feedSeriesFilter: null,
  setFeedSeriesFilter: (feedSeriesFilter) => set({ feedSeriesFilter }),
  dueCount: 0,
  setDueCount: (dueCount) => set({ dueCount }),
}));
