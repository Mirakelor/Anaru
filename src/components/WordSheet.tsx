import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import { lookupWord, type DictEntry } from '../lib/dict/lookup';
import { createCard } from '../lib/srs/engine';
import { toRomaji } from '../lib/nlp/romaji';
import { useApp } from '../state/store';
import { FuriganaText } from './FuriganaText';
import type { Word } from '../lib/types';

export function WordSheet() {
  const sheet = useApp((s) => s.wordSheet);
  const close = useApp((s) => s.closeWordSheet);
  const [entries, setEntries] = useState<DictEntry[] | null>(null);
  const [failed, setFailed] = useState(false);

  const saved = useLiveQuery(async () => {
    if (!sheet) return undefined;
    return db.words.where('lemma').equals(sheet.baseForm).first();
  }, [sheet?.baseForm]);

  useEffect(() => {
    if (!sheet) return;
    setEntries(null);
    setFailed(false);
    let cancelled = false;
    lookupWord(sheet.surface, sheet.baseForm, sheet.reading)
      .then((result) => !cancelled && setEntries(result))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [sheet]);

  if (!sheet) return null;

  const save = async () => {
    if (!sheet || saved) return;
    const entry = entries?.[0];
    const word: Word = {
      lemma: sheet.baseForm,
      reading: entry?.reading ?? sheet.reading,
      gloss: entry?.gloss ?? '',
      pos: entry?.pos ?? '',
      jlpt: entry?.jlpt ?? null,
      surface: sheet.surface,
      clipId: sheet.clip?.id ?? null,
      episodeId: sheet.episode?.id ?? null,
      sceneStart: sheet.clip?.start ?? null,
      sceneEnd: sheet.clip?.end ?? null,
      sentence: sheet.sentence,
      sentenceTranslation: sheet.sentenceTranslation,
      createdAt: Date.now(),
    };
    const wordId = (await db.words.add(word as Word))!;
    await createCard(wordId);
    close();
  };

  const remove = async () => {
    if (!saved) return;
    await db.transaction('rw', db.words, db.cards, db.reviews, async () => {
      await db.cards.where('wordId').equals(saved.id!).delete();
      await db.reviews.where('wordId').equals(saved.id!).delete();
      await db.words.delete(saved.id!);
    });
    close();
  };

  const best = entries?.[0];

  return (
    <div className="sheet-backdrop" onClick={close}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <div>
            <p className="sheet-word">
              <FuriganaText text={sheet.surface} size="sheet" />
            </p>
            <p className="sheet-reading">
              {sheet.reading}
              {sheet.reading && <span className="sheet-romaji"> {toRomaji(sheet.reading)}</span>}
            </p>
          </div>
          {best?.jlpt && <span className={`jlpt-badge n${best.jlpt}`}>N{best.jlpt}</span>}
        </div>

        {entries === null && !failed && <p className="sheet-status">Looking up…</p>}
        {failed && <p className="sheet-status">Dictionary is unavailable right now.</p>}
        {entries && entries.length === 0 && (
          <p className="sheet-status">Not in the dictionary yet — you can still save it.</p>
        )}

        {entries && entries.length > 0 && (
          <ul className="sheet-senses">
            {entries.slice(0, 2).map((entry, i) => (
              <li key={i}>
                {entry.pos && <span className="sheet-pos">{entry.pos}</span>}
                {entry.gloss}
              </li>
            ))}
          </ul>
        )}

        <div className="sheet-context">
          <p className="sheet-context-jp">
            <FuriganaText
              text={sheet.sentence}
              size="sheet"
              clip={sheet.clip}
              episode={sheet.episode}
              series={sheet.series}
              cue={sheet.cue}
              translation={sheet.sentenceTranslation}
            />
          </p>
          {sheet.sentenceTranslation && <p className="sheet-context-en">{sheet.sentenceTranslation}</p>}
          {sheet.series && <p className="sheet-context-src">{sheet.series.title}</p>}
        </div>

        <div className="sheet-actions">
          {saved ? (
            <>
              <button type="button" className="btn btn-ghost" onClick={close}>
                Close
              </button>
              <button type="button" className="btn btn-danger" onClick={remove}>
                Remove word
              </button>
            </>
          ) : (
            <>
              <button type="button" className="btn btn-ghost" onClick={close}>
                Close
              </button>
              <button type="button" className="btn btn-primary" onClick={save}>
                Save word
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
