import { useRef, useState, type DragEvent } from 'react';

import { Panel } from '../components/ui';
import { useDataset } from '../lib/dataset/useDataset';
import type { ImportError } from '../lib/contract/parse';

/** Client-side CSV import. Files are read with FileReader; nothing leaves the browser. */

export function ImportView() {
  const { importCsvText, resetToFixture, source, lastRejection } = useDataset();
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<'accepted' | 'rejected' | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFile(file: File) {
    setBusy(true);
    setOutcome(null);
    const reader = new FileReader();
    reader.onload = () => {
      const res = importCsvText(String(reader.result ?? ''));
      setOutcome(res.ok ? 'accepted' : 'rejected');
      setBusy(false);
    };
    reader.onerror = () => {
      setOutcome('rejected');
      setBusy(false);
    };
    reader.readAsText(file);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }

  return (
    <>
      <h1>Import a dataset</h1>
      <p className="footnote">
        Upload a CSV that follows the documented contract (schema 1.0.0). The file is parsed
        entirely in your browser — it is never transmitted anywhere. Import is all-or-nothing: a
        rejected file changes nothing.
      </p>

      <div
        className={`import-drop ${dragging ? 'dragging' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        {busy ? (
          <p>Validating…</p>
        ) : (
          <>
            <p>Drop a contract CSV here, or</p>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              style={{ font: 'inherit', padding: '0.4rem 1rem', cursor: 'pointer' }}
            >
              Choose file…
            </button>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              style={{ display: 'none' }}
              aria-label="Choose a contract CSV file"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.target.value = '';
              }}
            />
          </>
        )}
      </div>

      <div aria-live="polite">
        {outcome === 'accepted' ? (
          <Panel
            title="Import accepted"
            note="All views now show the imported dataset (browser memory only)."
          >
            <p>
              The file passed all validation rules.{' '}
              <button className="linklike" onClick={resetToFixture}>
                Restore the bundled demo dataset
              </button>
            </p>
          </Panel>
        ) : null}
        {outcome === 'rejected' && lastRejection ? (
          <RejectionReport errors={lastRejection} />
        ) : null}
      </div>

      {source === 'import' && outcome !== 'accepted' ? (
        <p className="footnote">
          Currently showing a previously imported dataset.{' '}
          <button className="linklike" onClick={resetToFixture}>
            Restore the bundled demo dataset
          </button>
        </p>
      ) : null}

      <Panel
        title="What the validator checks"
        note="Full rule list in docs/import-validation-rules.md (V01–V18). Try the files under data/sample/invalid/ to see rejections."
      >
        <ul className="footnote">
          <li>Schema version, required columns, closed enums (V02, V03, V06)</li>
          <li>Duplicate record ids and duplicate natural keys (V04, V05)</li>
          <li>Numbers parse; blank values must be flagged missing (V07, V08)</li>
          <li>
            Period coherence and percent plausibility — decimals, not whole percents (V09, V10)
          </li>
          <li>Allocation weights sum to 100%; contribution reconciles (V13, V14)</li>
          <li>reported_public confined to cited reference rows (V15)</li>
        </ul>
      </Panel>
    </>
  );
}

function RejectionReport({ errors }: { errors: ImportError[] }) {
  return (
    <Panel
      title={`Import rejected — ${errors.length} error${errors.length === 1 ? '' : 's'}`}
      note="Nothing was changed. Fix the listed rows and try again."
    >
      <div className="error-list" role="alert">
        {errors.slice(0, 50).map((e, i) => (
          <div key={i}>
            [{e.ruleId}] row {e.row} · {e.column}: {e.message}
            {e.value !== undefined ? ` (value: ${JSON.stringify(e.value)})` : ''}
          </div>
        ))}
        {errors.length > 50 ? <div>… {errors.length - 50} more</div> : null}
      </div>
    </Panel>
  );
}
