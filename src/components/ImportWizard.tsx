import { useRef, useState } from 'react';
import { createSeries, importEpisode, attachTranslations } from '../lib/import/library';
import { parseSubtitles } from '../lib/subtitles/parse';

interface PendingEpisode {
  video: File | null;
  subtitle: File | null;
  translation: File | null;
}

export function ImportWizard({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<1 | 2>(1);
  const [title, setTitle] = useState('');
  const [episodes, setEpisodes] = useState<PendingEpisode[]>([{ video: null, subtitle: null, translation: null }]);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState('');
  const [error, setError] = useState<string | null>(null);

  const updateEpisode = (index: number, patch: Partial<PendingEpisode>) => {
    setEpisodes((list) => list.map((ep, i) => (i === index ? { ...ep, ...patch } : ep)));
  };

  const runnable = title.trim().length > 0 && episodes.every((ep) => ep.video && ep.subtitle);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const series = await createSeries({ title: title.trim(), source: 'user' });
      for (let i = 0; i < episodes.length; i++) {
        const ep = episodes[i];
        setStage(`Episode ${i + 1} of ${episodes.length}: reading files…`);
        const subtitleText = await ep.subtitle!.text();
        const episodeResult = await importEpisode(series, {
          index: i + 1,
          title: `Episode ${i + 1}`,
          video: ep.video!,
          subtitleName: ep.subtitle!.name,
          subtitleText,
        }, setStage);
        if (ep.translation) {
          setStage(`Episode ${i + 1}: attaching translations…`);
          const translationText = await ep.translation.text();
          const translationCues = parseSubtitles(ep.translation.name, translationText);
          await attachTranslations(episodeResult.episodeId, translationCues.map((c) => ({ start: c.start, text: c.text })));
        }
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed.');
      setBusy(false);
      setStage('');
    }
  };

  return (
    <div className="sheet-backdrop" onClick={busy ? undefined : onClose}>
      <div className="sheet sheet-wide" onClick={(e) => e.stopPropagation()}>
        {step === 1 && (
          <>
            <h2 className="sheet-title">Add a series</h2>
            <label className="field">
              <span>Series name</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Frieren: Beyond Journey's End"
                autoFocus
              />
            </label>
            <p className="field-hint">
              You will need the video file and a Japanese subtitle file (SRT or ASS) for each episode. An optional
              English subtitle file powers the bilingual mode.
            </p>
            {error && <p className="field-error">{error}</p>}
            <div className="sheet-actions">
              <button type="button" className="btn btn-ghost" onClick={onClose}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={title.trim().length === 0}
                onClick={() => setStep(2)}
              >
                Next
              </button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h2 className="sheet-title">Episodes — {title}</h2>
            {episodes.map((ep, i) => (
              <div className="import-episode" key={i}>
                <p className="import-episode-title">Episode {i + 1}</p>
                <FilePicker
                  label="Video (mp4/webm)"
                  accept="video/mp4,video/webm,video/*"
                  file={ep.video}
                  onPick={(file) => updateEpisode(i, { video: file })}
                />
                <FilePicker
                  label="Japanese subtitles (.srt/.ass)"
                  accept=".srt,.ass,.ssa,text/plain"
                  file={ep.subtitle}
                  onPick={(file) => updateEpisode(i, { subtitle: file })}
                />
                <FilePicker
                  label="English subtitles (optional)"
                  accept=".srt,.ass,.ssa,text/plain"
                  file={ep.translation}
                  onPick={(file) => updateEpisode(i, { translation: file })}
                />
                {episodes.length > 1 && (
                  <button
                    type="button"
                    className="btn btn-small btn-ghost"
                    onClick={() => setEpisodes((list) => list.filter((_, k) => k !== i))}
                  >
                    Remove episode
                  </button>
                )}
              </div>
            ))}

            <div className="import-add">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setEpisodes((list) => [...list, { video: null, subtitle: null, translation: null }])}
              >
                + Add episode
              </button>
            </div>

            {busy && <p className="field-hint">{stage || 'Importing…'}</p>}
            {error && <p className="field-error">{error}</p>}

            <div className="sheet-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setStep(1)} disabled={busy}>
                Back
              </button>
              <button type="button" className="btn btn-primary" disabled={!runnable || busy} onClick={run}>
                {busy ? 'Importing…' : `Import ${episodes.length} episode${episodes.length === 1 ? '' : 's'}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

interface FilePickerProps {
  label: string;
  accept: string;
  file: File | null;
  onPick: (file: File) => void;
}

function FilePicker({ label, accept, file, onPick }: FilePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className={`file-picker ${file ? 'picked' : ''}`}>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        hidden
        onChange={(e) => {
          const picked = e.target.files?.[0];
          if (picked) onPick(picked);
          e.target.value = '';
        }}
      />
      <button type="button" className="btn btn-small" onClick={() => inputRef.current?.click()}>
        {file ? file.name : label}
      </button>
      {file && <span className="file-size">{(file.size / 1024 / 1024).toFixed(0)} MB</span>}
    </div>
  );
}
