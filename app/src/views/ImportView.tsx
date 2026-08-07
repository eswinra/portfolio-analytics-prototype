import { useRef, useState, type DragEvent } from 'react';

import invalidSampleCsv from '../../../data/sample/invalid/bad_schema_version.csv?raw';
import templateCsv from '../../../data/sample/market_pulse_template.csv?raw';
import { Panel, Pill } from '../components/ui';
import { useDataset } from '../lib/dataset/useDataset';
import type { ImportError } from '../lib/contract/parse';

/** Client-side CSV import with a preflight stage. Files never leave the browser. */

function downloadText(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function ImportView() {
  const { stageCsvText, applyStaged, discardStaged, resetToFixture, source, preflight } =
    useDataset();
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [applied, setApplied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFile(file: File) {
    setBusy(true);
    setApplied(false);
    const reader = new FileReader();
    reader.onload = () => {
      stageCsvText(String(reader.result ?? ''), file.name);
      setBusy(false);
    };
    reader.onerror = () => setBusy(false);
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

      <div className="panel confidentiality-warning" role="note">
        <strong>Do not upload confidential or non-public portfolio information.</strong> Files never
        leave your browser, but this public site is for synthetic/shareable data only.{' '}
        <details className="inline-details">
          <summary>Licensed-data guidance</summary>
          Licensed market data (e.g., Bloomberg exports) is for your internal use: run the app
          locally or on an internal host for that workflow, and never commit exports to the
          repository.
        </details>
      </div>

      <p className="footnote">
        Contract CSV (schema 1.x). Preflighted: validated and summarized first — nothing changes
        until you apply it.
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
        {preflight ? (
          <Panel
            title={`Preflight — ${preflight.fileName}`}
            note="Nothing has been applied yet. Review the summary, then apply or discard."
          >
            <div className="table-scroll">
              <table>
                <caption>Preflight summary</caption>
                <tbody>
                  <tr>
                    <td>Rows scanned</td>
                    <td className="num">{preflight.rowsScanned}</td>
                  </tr>
                  <tr>
                    <td>Portfolio entity</td>
                    <td className="num">{preflight.entityId}</td>
                  </tr>
                  <tr>
                    <td>Blocking errors</td>
                    <td className="num">
                      <Pill tone={preflight.errors.length ? 'bad' : 'good'}>
                        {preflight.errors.length}
                      </Pill>
                    </td>
                  </tr>
                  <tr>
                    <td>Warnings</td>
                    <td className="num">
                      <Pill tone={preflight.warnings.length ? 'warn' : 'good'}>
                        {preflight.warnings.length}
                      </Pill>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            {preflight.errors.length > 0 ? <ErrorList errors={preflight.errors} /> : null}
            {preflight.warnings.length > 0 ? (
              <ul className="footnote">
                {preflight.warnings.map((w, i) => (
                  <li key={i}>
                    [{w.ruleId}] {w.message}
                  </li>
                ))}
              </ul>
            ) : null}
            <p>
              {preflight.ok ? (
                <button
                  type="button"
                  style={{ font: 'inherit', padding: '0.4rem 1rem', cursor: 'pointer' }}
                  onClick={() => setApplied(applyStaged())}
                >
                  Apply this dataset
                </button>
              ) : (
                <button
                  className="linklike"
                  onClick={() =>
                    downloadText(
                      'import-errors.csv',
                      ['ruleId,severity,row,column,message']
                        .concat(
                          preflight.errors.map(
                            (e) =>
                              `${e.ruleId},${e.severity},${e.row},"${e.column}","${e.message.replaceAll('"', '""')}"`,
                          ),
                        )
                        .join('\n'),
                    )
                  }
                >
                  Download error report (CSV)
                </button>
              )}{' '}
              <button className="linklike" onClick={discardStaged}>
                Discard
              </button>
            </p>
          </Panel>
        ) : null}
        {applied ? (
          <Panel
            title="Import applied"
            note="All views now show the imported dataset (browser memory only)."
          >
            <p>
              <button className="linklike" onClick={resetToFixture}>
                Restore the bundled demo dataset
              </button>
            </p>
          </Panel>
        ) : null}
      </div>

      {source === 'import' && !applied ? (
        <p className="footnote">
          Currently showing a previously imported dataset.{' '}
          <button className="linklike" onClick={resetToFixture}>
            Restore the bundled demo dataset
          </button>
        </p>
      ) : null}

      <Panel
        title="Templates and test files"
        note="The market-pulse template is a one-day skeleton for a Bloomberg BDH export: refresh your terminal workbook, lay the closes out in these columns, save as CSV, and import. Internal use only for licensed data."
      >
        <ul>
          <li>
            <button
              className="linklike"
              onClick={() => downloadText('market_pulse_template.csv', templateCsv)}
            >
              Download market-pulse CSV template
            </button>
          </li>
          <li>
            <button
              className="linklike"
              onClick={() => downloadText('invalid_sample.csv', invalidSampleCsv)}
            >
              Download an invalid sample (bad schema version)
            </button>{' '}
            — try importing it to see a rejection.
          </li>
          <li>
            <a
              href="https://github.com/eswinra/portfolio-analytics-prototype/blob/main/docs/import-validation-rules.md"
              target="_blank"
              rel="noreferrer"
            >
              View the full validation rules (V01–V18)
            </a>
          </li>
        </ul>
      </Panel>

      <details className="panel">
        <summary>What the validator checks (V01–V18)</summary>
        <ul className="footnote" style={{ marginTop: '0.6rem' }}>
          <li>Schema version, required columns, closed enums (V02, V03, V06)</li>
          <li>Duplicate record ids and duplicate natural keys (V04, V05)</li>
          <li>
            Numbers parse; blank or missing-flagged values never render numerically (V07, V08)
          </li>
          <li>Period coherence; percent plausibility on return/contribution records (V09, V10)</li>
          <li>Allocation weights sum to 100%; contribution reconciles (V13, V14)</li>
          <li>reported_public confined to quotation record types (V15)</li>
          <li>Exactly one portfolio entity per file (V17)</li>
        </ul>
      </details>
    </>
  );
}

function ErrorList({ errors }: { errors: ImportError[] }) {
  return (
    <div className="error-list" role="alert">
      {errors.slice(0, 50).map((e, i) => (
        <div key={i}>
          [{e.ruleId}] row {e.row} · {e.column}: {e.message}
          {e.value !== undefined ? ` (value: ${JSON.stringify(e.value)})` : ''}
        </div>
      ))}
      {errors.length > 50 ? <div>… {errors.length - 50} more</div> : null}
    </div>
  );
}
