import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, deleteMediaFile } from '../lib/db';
import type { Series } from '../lib/types';
import { useApp } from '../state/store';
import { ImportWizard } from '../components/ImportWizard';
import { PackModal } from '../components/PackModal';
import { ingestPack } from '../lib/import/library';
import { DEFAULT_PACK_URL } from '../lib/config';

export function LibraryPage() {
  const [importOpen, setImportOpen] = useState(false);
  const [packOpen, setPackOpen] = useState(false);
  const series = useLiveQuery(() => db.series.orderBy('addedAt').toArray(), []);
  const setTab = useApp((s) => s.setTab);
  const setFilter = useApp((s) => s.setFeedSeriesFilter);
  const [confirmDelete, setConfirmDelete] = useState<Series | null>(null);
  const [autoImporting, setAutoImporting] = useState(false);
  const [autoStage, setAutoStage] = useState('');
  const autoImportTried = useRef(false);

  // An empty library auto-loads the built-in starter pack (once), so the app
  // shows its bundled series even if onboarding was completed long ago.
  useEffect(() => {
    if (!series || series.length > 0 || autoImportTried.current || !DEFAULT_PACK_URL) return;
    autoImportTried.current = true;
    setAutoImporting(true);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 120_000);
    ingestPack(DEFAULT_PACK_URL, setAutoStage, controller.signal)
      .catch(() => undefined)
      .finally(() => {
        clearTimeout(timer);
        setAutoImporting(false);
      });
  }, [series]);

  if (!series) return <div className="page-loading" />;

  const watch = (item: Series) => {
    setFilter(item.id!);
    setTab('feed');
  };

  const toggleSpoiler = async (item: Series) => {
    await db.series.update(item.id!, { spoilerHidden: !item.spoilerHidden });
  };

  const remove = async (item: Series) => {
    const episodes = await db.episodes.where('seriesId').equals(item.id!).toArray();
    await db.transaction('rw', db.series, db.episodes, db.cues, db.clips, async () => {
      for (const episode of episodes) {
        await db.cues.where('episodeId').equals(episode.id!).delete();
        await db.clips.where('episodeId').equals(episode.id!).delete();
        if (episode.videoPath) await deleteMediaFile(episode.videoPath);
      }
      await db.episodes.where('seriesId').equals(item.id!).delete();
      await db.series.delete(item.id!);
    });
    setConfirmDelete(null);
  };

  return (
    <div className="page library">
      <div className="page-head">
        <h1>Library</h1>
        <div className="page-head-actions">
          <button type="button" className="btn btn-ghost" onClick={() => setPackOpen(true)}>
            Load pack
          </button>
          <button type="button" className="btn btn-primary" onClick={() => setImportOpen(true)}>
            Add series
          </button>
        </div>
      </div>
      <p className="page-sub">
        Every series you add becomes a feed of short scenes. Hide a series until you have watched it — its clips stay
        out of your feed.
      </p>

      {series.length === 0 && (
        <div className="library-empty">
          {autoImporting ? (
            <>
              <p>Loading the starter pack…</p>
              <p className="muted">{autoStage || 'Downloading subtitles…'}</p>
            </>
          ) : (
            <>
              <p>Your library is empty.</p>
              <p className="muted">
                Load a content pack, or add your own anime with Japanese subtitles. The pack builder in the repo turns a
                folder of videos and subtitle files into a pack.
              </p>
            </>
          )}
        </div>
      )}

      <div className="series-grid">
        {series.map((item) => (
          <SeriesCard
            key={item.id}
            series={item}
            onWatch={() => watch(item)}
            onToggleSpoiler={() => toggleSpoiler(item)}
            onDelete={() => setConfirmDelete(item)}
          />
        ))}
      </div>

      {importOpen && <ImportWizard onClose={() => setImportOpen(false)} />}
      {packOpen && <PackModal onClose={() => setPackOpen(false)} />}

      {confirmDelete && (
        <div className="sheet-backdrop" onClick={() => setConfirmDelete(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <h2 className="sheet-title">Delete {confirmDelete.title}?</h2>
            <p className="sheet-status">Its episodes, clips and subtitles will be removed. Saved words stay.</p>
            <div className="sheet-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setConfirmDelete(null)}>
                Keep
              </button>
              <button type="button" className="btn btn-danger" onClick={() => remove(confirmDelete)}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface SeriesCardProps {
  series: Series;
  onWatch: () => void;
  onToggleSpoiler: () => void;
  onDelete: () => void;
}

function SeriesCard({ series, onWatch, onToggleSpoiler, onDelete }: SeriesCardProps) {
  const counts = useLiveQuery(async () => {
    const episodes = await db.episodes.where('seriesId').equals(series.id!).count();
    const clips = await db.clips.where('seriesId').equals(series.id!).count();
    return { episodes, clips };
  }, [series.id]);

  return (
    <div className={`series-card ${series.spoilerHidden ? 'hidden-series' : ''}`}>
      <div className="series-poster">
        {series.posterPath ? (
          <img src={series.posterPath} alt="" loading="lazy" />
        ) : (
          <div className="series-poster-fallback">{series.title.slice(0, 1)}</div>
        )}
        {series.spoilerHidden && <span className="series-hidden-tag">Hidden</span>}
      </div>
      <div className="series-meta">
        <p className="series-title">{series.title}</p>
        <p className="series-counts">
          {counts ? `${counts.episodes} episode${counts.episodes === 1 ? '' : 's'} · ${counts.clips} clips` : '…'}
        </p>
      </div>
      <div className="series-actions">
        <button type="button" className="btn btn-small" onClick={onWatch}>
          Watch
        </button>
        <button
          type="button"
          className="btn btn-small btn-ghost"
          onClick={onToggleSpoiler}
          title={series.spoilerHidden ? 'Show in feed' : 'Hide until watched'}
        >
          {series.spoilerHidden ? 'Unhide' : 'Hide'}
        </button>
        <button type="button" className="btn btn-small btn-ghost" onClick={onDelete} aria-label={`Delete ${series.title}`}>
          ✕
        </button>
      </div>
    </div>
  );
}
