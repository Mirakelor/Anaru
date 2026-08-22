import { useState, type CSSProperties } from 'react';
import { clearAllData, updateSettings } from '../lib/db';
import { SUBTITLE_MODES, type SubtitleMode } from '../lib/types';
import { THEMES } from '../lib/themes';
import { useSettings } from '../state/useSettings';
import { DEFAULT_PACK_URL } from '../lib/config';

export function SettingsPage() {
  const settings = useSettings();
  const [confirmClear, setConfirmClear] = useState(false);

  if (!settings) return <div className="page-loading" />;

  return (
    <div className="page settings">
      <div className="page-head">
        <h1>Settings</h1>
      </div>

      <section className="settings-section">
        <h2>Theme</h2>
        <p className="settings-hint">Pick a look. The whole app recolors instantly.</p>
        <div className="theme-list">
          {THEMES.map((theme) => (
            <button
              key={theme.id}
              type="button"
              className={`theme-option ${settings.themeId === theme.id ? 'active' : ''}`}
              onClick={() => updateSettings({ themeId: theme.id })}
              style={{ '--swatch-bg': theme.vars['--bg'], '--swatch-accent': theme.vars['--accent'] } as CSSProperties}
            >
              <span className="theme-swatch" />
              <span className="theme-name">{theme.name}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="settings-section">
        <h2>Content</h2>
        <p className="settings-hint">
          Default content source:{' '}
          {DEFAULT_PACK_URL ? <code>{DEFAULT_PACK_URL}</code> : 'not configured — use Load pack in the Library'}
        </p>
      </section>

      <section className="settings-section">
        <h2>Subtitles</h2>
        <p className="settings-hint">Five modes, from romaji on day one to video only.</p>
        <div className="mode-list">
          {SUBTITLE_MODES.map((mode) => (
            <button
              key={mode.id}
              type="button"
              className={`mode-option ${settings.subtitleMode === mode.id ? 'active' : ''}`}
              onClick={() => updateSettings({ subtitleMode: mode.id as SubtitleMode })}
            >
              <span className="mode-name">{mode.name}</span>
              <span className="mode-hint">{mode.hint}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="settings-section">
        <h2>Playback</h2>
        <div className="setting-row">
          <span>Speed</span>
          <div className="segmented">
            {[0.75, 1, 1.25].map((rate) => (
              <button
                key={rate}
                type="button"
                className={settings.playbackRate === rate ? 'active' : ''}
                onClick={() => updateSettings({ playbackRate: rate })}
              >
                {rate}×
              </button>
            ))}
          </div>
        </div>
        <label className="setting-row">
          <span>Loop each clip</span>
          <input
            type="checkbox"
            checked={settings.autoReplay}
            onChange={(e) => updateSettings({ autoReplay: e.target.checked })}
          />
        </label>
      </section>

      <section className="settings-section">
        <h2>Reviews</h2>
        <label className="setting-row">
          <span>Listening cards (audio first)</span>
          <input
            type="checkbox"
            checked={settings.listeningCards}
            onChange={(e) => updateSettings({ listeningCards: e.target.checked })}
          />
        </label>
      </section>

      <section className="settings-section">
        <h2>Data</h2>
        {confirmClear ? (
          <div className="setting-row">
            <span>Delete everything — series, words, reviews?</span>
            <div>
              <button type="button" className="btn btn-small" onClick={() => setConfirmClear(false)}>
                Keep
              </button>{' '}
              <button
                type="button"
                className="btn btn-small btn-danger"
                onClick={async () => {
                  await clearAllData();
                  setConfirmClear(false);
                }}
              >
                Delete
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="btn btn-ghost" onClick={() => setConfirmClear(true)}>
            Erase all data
          </button>
        )}
      </section>

      <section className="settings-section about">
        <h2>About</h2>
        <p>
          Anaru is free, offline and open data. Words come from the anime you watch; nothing is generated. Dictionary
          data © JMdict (CC BY-SA), tokenization by Kuromoji (IPA dictionary), scheduling by FSRS.
        </p>
        <p className="muted">Version 0.1.0</p>
      </section>
    </div>
  );
}
