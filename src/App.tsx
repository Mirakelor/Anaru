import { useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { dueItems } from './lib/srs/engine';
import { useApp, type Tab } from './state/store';
import { useSettings } from './state/useSettings';
import { applyTheme, themeById } from './lib/themes';
import { FeedPage } from './components/Feed';
import { WordSheet } from './components/WordSheet';
import { LibraryPage } from './pages/LibraryPage';
import { ReviewPage } from './pages/ReviewPage';
import { WordsPage } from './pages/WordsPage';
import { StatsPage } from './pages/StatsPage';
import { SettingsPage } from './pages/SettingsPage';
import { Onboarding } from './pages/Onboarding';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'feed', label: 'Feed', icon: 'M7 4h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM10 9l5 3-5 3V9z' },
  { id: 'library', label: 'Library', icon: 'M4 5h12v14H4zM18 7h2v10h-2z' },
  { id: 'review', label: 'Review', icon: 'M4 12a8 8 0 0 1 13.6-5.7L20 8.5M20 4v4.5h-4.5M20 12a8 8 0 0 1-13.6 5.7L4 15.5M4 20v-4.5h4.5' },
  { id: 'words', label: 'Words', icon: 'M6 4h12v16H6zM9 8h6M9 12h6M9 16h4' },
  { id: 'stats', label: 'Stats', icon: 'M5 20v-6M10 20V6M15 20v-9M20 20v-4M3 20h18' },
  { id: 'settings', label: 'Settings', icon: 'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.9 2.9l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.9-2.9l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.9-2.9l.1.1a1.7 1.7 0 0 0 1.9.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.9 2.9l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z' },
];

export default function App() {
  const settings = useSettings();
  const tab = useApp((s) => s.tab);
  const setTab = useApp((s) => s.setTab);
  const dueCount = useApp((s) => s.dueCount);
  const setDueCount = useApp((s) => s.setDueCount);
  const filter = useApp((s) => s.feedSeriesFilter);
  const setFilter = useApp((s) => s.setFeedSeriesFilter);

  const due = useLiveQuery(() => dueItems(), []);
  useEffect(() => {
    if (due) setDueCount(due.length);
  }, [due, setDueCount]);

  useEffect(() => {
    applyTheme(themeById(settings?.themeId));
  }, [settings?.themeId]);

  if (!settings) return <div className="app-boot" />;

  if (!settings.onboarded) {
    return <Onboarding />;
  }

  return (
    <div className="app">
      <main className="app-main">
        {filter !== null && tab === 'feed' && (
          <div className="feed-filter-bar">
            <span>Filtered to one series</span>
            <button type="button" onClick={() => setFilter(null)}>
              Show all
            </button>
          </div>
        )}
        {tab === 'feed' && <FeedPage />}
        {tab === 'library' && <LibraryPage />}
        {tab === 'review' && <ReviewPage />}
        {tab === 'words' && <WordsPage />}
        {tab === 'stats' && <StatsPage />}
        {tab === 'settings' && <SettingsPage />}
      </main>
      <nav className="tabbar">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`tab ${tab === item.id ? 'active' : ''}`}
            onClick={() => setTab(item.id)}
          >
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d={item.icon} />
            </svg>
            <span>{item.label}</span>
            {item.id === 'review' && dueCount > 0 && <em className="tab-badge">{dueCount > 99 ? '99+' : dueCount}</em>}
          </button>
        ))}
      </nav>
      <WordSheet />
    </div>
  );
}
