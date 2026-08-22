import { useState } from 'react';
import { ingestPack } from '../lib/import/library';

export function PackModal({ onClose }: { onClose: () => void }) {
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [doneClips, setDoneClips] = useState<number | null>(null);

  const load = async () => {
    setBusy(true);
    setError(null);
    setDoneClips(null);
    try {
      const clips = await ingestPack(url.trim(), setStage);
      setDoneClips(clips);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Loading the pack failed.');
      setBusy(false);
      setStage('');
    }
  };

  return (
    <div className="sheet-backdrop" onClick={busy ? undefined : onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <h2 className="sheet-title">Load a content pack</h2>
        <p className="field-hint">
          Paste the URL of a pack manifest (manifest.json). Packs stream their videos from wherever you host them — a
          NAS, object storage or any static server. Build one from your own files with tools/pack.
        </p>
        <label className="field">
          <span>Manifest URL</span>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/packs/manifest.json"
            autoFocus
          />
        </label>
        {busy && <p className="settings-progress">{stage || 'Loading…'}</p>}
        {error && <p className="field-error">{error}</p>}
        {doneClips !== null && <p className="settings-ok">Pack loaded — {doneClips} clips ready.</p>}
        <div className="sheet-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" disabled={busy || url.trim().length === 0} onClick={load}>
            {busy ? 'Loading…' : 'Load pack'}
          </button>
        </div>
      </div>
    </div>
  );
}
