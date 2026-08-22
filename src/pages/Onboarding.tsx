import { useEffect, useState } from 'react';
import { updateSettings } from '../lib/db';
import { SUBTITLE_MODES, type SubtitleMode } from '../lib/types';
import { ingestPack } from '../lib/import/library';
import { DEFAULT_PACK_URL } from '../lib/config';

const SIM_EPISODES = [
  { title: '星の旅路', ep: 'EP.03', lines: [0, 3] },
  { title: '剣道少女', ep: 'EP.01', lines: [1, 4] },
  { title: '春の約束', ep: 'EP.02', lines: [2, 5] },
];

const SIM_LINES = [
  { jp: '凄い力だな', ruby: [['凄', 'すご'], ['力', 'ちから']], romaji: 'sugoi chikara da na', en: 'What a tremendous power.' },
  { jp: '逃げろ！', ruby: [['逃', 'に']], romaji: 'nigero!', en: 'Run!' },
  { jp: 'これは私の夢だ', ruby: [['私', 'わたし'], ['夢', 'ゆめ']], romaji: 'kore wa watashi no yume da', en: 'This is my dream.' },
  { jp: '約束する、絶対に', ruby: [['約', 'やく'], ['束', 'そく'], ['絶', 'ぜっ'], ['対', 'たい']], romaji: 'yakusoku suru, zettai ni', en: 'I promise — for certain.' },
  { jp: '仲間を守りたい心だ', ruby: [['仲', 'なか'], ['間', 'ま'], ['守', 'まも'], ['心', 'こころ']], romaji: 'nakama o mamoritai kokoro da', en: 'A heart that wants to protect its comrades.' },
  { jp: 'もう一度、会いに行こう', ruby: [['一', 'いち'], ['度', 'ど'], ['会', 'あ']], romaji: 'mou ichido, ai ni ikou', en: 'Let us go meet them once more.' },
];

function RubyText({ line }: { line: (typeof SIM_LINES)[number] }) {
  return (
    <>
      {Array.from(line.jp).map((ch, i) => {
        const ruby = line.ruby.find((r) => r[0] === ch);
        return ruby ? (
          <ruby key={i}>
            {ch}
            <rt>{ruby[1]}</rt>
          </ruby>
        ) : (
          <span key={i}>{ch}</span>
        );
      })}
    </>
  );
}

export function Onboarding() {
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState<SubtitleMode>(2);
  const [simIndex, setSimIndex] = useState(0);
  const [muted, setMuted] = useState(true);
  const [liked, setLiked] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importStage, setImportStage] = useState('');

  useEffect(() => {
    const timer = setInterval(() => setSimIndex((i) => (i + 1) % SIM_LINES.length), 4400);
    return () => clearInterval(timer);
  }, []);

  const finish = async () => {
    await updateSettings({ subtitleMode: mode, onboarded: true });
    if (DEFAULT_PACK_URL) {
      setImporting(true);
      try {
        await ingestPack(DEFAULT_PACK_URL, setImportStage);
      } catch {
        /* content source unavailable — never block onboarding */
      }
      setImporting(false);
    }
  };

  const line = SIM_LINES[simIndex];
  const episode = SIM_EPISODES[Math.floor(simIndex / 2) % SIM_EPISODES.length];

  return (
    <div className="onboarding">
      {step === 0 && (
        <div className="onboard-hero">
          <p className="onboard-logo">Anaru</p>
          <h1>
            The anime you love,
            <br />
            now teaching you Japanese.
          </h1>
          <p className="onboard-sub">
            Real scenes. Furigana on every kanji. Tap a word to save it — review it like Anki.
          </p>
          <div className="onboard-device">
            <div className={`fs-scene fs-scene-${Math.floor(simIndex / 2) % 3}`}>
              <div className="fs-sky" />
              <div className="fs-stars" />
              <div className="fs-sun" />
              <div className="fs-petals" />
              <div className="fs-hills" />
              <div className="fs-top">
                <span>
                  {episode.title} · {episode.ep}
                </span>
              </div>
              <div className="fs-progress" key={simIndex}>
                <span />
              </div>
              <div className="fs-line-wrap" key={`l${simIndex}`}>
                <p className="fs-line">
                  <RubyText line={line} />
                </p>
                <p className="fs-romaji">{line.romaji}</p>
                <p className="fs-en">{line.en}</p>
              </div>
              <div className="fs-ui">
                <button
                  type="button"
                  className={`fs-btn ${muted ? '' : 'on'}`}
                  onClick={() => setMuted((m) => !m)}
                  aria-label={muted ? 'Unmute' : 'Mute'}
                >
                  {muted ? (
                    <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor">
                      <path d="M3 10v4h4l5 5V5L7 10H3zm18.6 2 2.1-2.1-1.4-1.4-2.1 2.1-2.1-2.1-1.4 1.4 2.1 2.1-2.1 2.1 1.4 1.4 2.1-2.1 2.1 2.1 1.4-1.4-2.1-2.1z" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor">
                      <path d="M3 10v4h4l5 5V5L7 10H3zm13.5 2a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4zM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z" />
                    </svg>
                  )}
                </button>
                <button
                  type="button"
                  className={`fs-btn ${liked ? 'liked' : ''}`}
                  onClick={() => setLiked((l) => !l)}
                  aria-label="Like"
                >
                  <svg viewBox="0 0 24 24" width="15" height="15" fill={liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8">
                    <path d="M12 21s-7.5-4.9-10-9.5C.5 8 2.5 4.5 6 4.5c2.2 0 3.8 1.2 6 3.4 2.2-2.2 3.8-3.4 6-3.4 3.5 0 5.5 3.5 4 7C19.5 16.1 12 21 12 21z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
          <button type="button" className="btn btn-primary onboard-cta" onClick={() => setStep(1)}>
            Get started
          </button>
          <p className="onboard-footnote">Free · Offline · No account · No ads</p>
        </div>
      )}

      {step === 1 && (
        <div className="onboard-step">
          <h2>How do you want your subtitles?</h2>
          <p className="page-sub">Switch any time — five modes, from romaji to no subtitles at all.</p>
          <div className="mode-list">
            {SUBTITLE_MODES.map((option) => (
              <button
                key={option.id}
                type="button"
                className={`mode-option ${mode === option.id ? 'active' : ''}`}
                onClick={() => setMode(option.id as SubtitleMode)}
              >
                <span className="mode-name">{option.name}</span>
                <span className="mode-hint">{option.hint}</span>
              </button>
            ))}
          </div>
          <div className="onboard-actions">
            <button type="button" className="btn btn-primary" onClick={finish} disabled={importing}>
              {importing ? 'Loading content…' : 'Start watching'}
            </button>
          </div>
          {importing && <p className="settings-progress">{importStage || 'Loading…'}</p>}
          <p className="onboard-footnote">Add your own anime with Japanese subtitles from the Library tab.</p>
        </div>
      )}
    </div>
  );
}
