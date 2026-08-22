import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import { FuriganaText } from '../components/FuriganaText';

export function WordsPage() {
  const [query, setQuery] = useState('');
  const words = useLiveQuery(() => db.words.orderBy('createdAt').reverse().toArray(), []);

  if (!words) return <div className="page-loading" />;

  const filtered = query.trim()
    ? words.filter(
        (w) =>
          w.lemma.includes(query) ||
          w.reading.includes(query) ||
          w.surface.includes(query) ||
          w.gloss.toLowerCase().includes(query.toLowerCase()),
      )
    : words;

  return (
    <div className="page words">
      <div className="page-head">
        <h1>Words</h1>
        <span className="page-count">{words.length} saved</span>
      </div>
      <input
        className="search-input"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search your words…"
      />

      {filtered.length === 0 && (
        <p className="page-sub">
          {words.length === 0
            ? 'Tap any word in the subtitles to save it here. Each saved word becomes a review card.'
            : 'No words match that search.'}
        </p>
      )}

      <ul className="word-list">
        {filtered.map((word) => (
          <li key={word.id} className="word-row">
            <div className="word-row-main">
              <p className="word-row-lemma">
                <FuriganaText text={word.surface !== word.lemma ? `${word.surface} → ${word.lemma}` : word.lemma} size="sheet" />
              </p>
              <p className="word-row-gloss">{word.gloss || '—'}</p>
            </div>
            <div className="word-row-side">
              {word.jlpt && <span className={`jlpt-badge n${word.jlpt}`}>N{word.jlpt}</span>}
              <span className="word-row-pos">{word.pos}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
