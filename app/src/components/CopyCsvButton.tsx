import { useRef, useState } from 'react';

/** Copies the panel's table as CSV, so a figure can go into Excel without retyping it or
 *  reopening the PDF. Serializes the rendered table (headers included, one row per row, values
 *  as displayed); a value that shows as an em dash on screen stays an em dash in the file, and a
 *  leading =, +, - or @ is prefixed with an apostrophe so a spreadsheet treats it as text rather
 *  than a formula.
 *
 *  Panel renders one of these in every panel; CSS (`.panel:not(:has(table))`) hides it where
 *  there is no table, so presence is a style question rather than a render-time DOM probe. Where
 *  :has() is unsupported the button stays visible and says there is nothing to copy. */

const cell = (raw: string) => {
  const t = raw.replace(/\s+/g, ' ').trim();
  const safe = /^[=+\-@]/.test(t) ? `'${t}` : t;
  return /[",\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
};

export function tableToCsv(table: HTMLTableElement): string {
  return [...table.rows]
    .map((r) => [...r.cells].map((c) => cell(c.innerText || c.textContent || '')).join(','))
    .join('\n');
}

export function CopyCsvButton({ label = 'Copy table as CSV' }: { label?: string }) {
  const ref = useRef<HTMLButtonElement>(null);
  const [state, setState] = useState<'idle' | 'copied' | 'failed' | 'empty'>('idle');

  async function copy() {
    const table = ref.current?.closest('.panel')?.querySelector('table');
    if (!table) {
      setState('empty');
      setTimeout(() => setState('idle'), 2600);
      return;
    }
    try {
      await navigator.clipboard.writeText(tableToCsv(table as HTMLTableElement));
      setState('copied');
    } catch {
      setState('failed');
    }
    setTimeout(() => setState('idle'), 2600);
  }

  const text =
    state === 'copied'
      ? 'Copied ✓'
      : state === 'failed'
        ? 'Copy failed'
        : state === 'empty'
          ? 'No table in this panel'
          : label;
  return (
    <span className="copy-csv-slot">
      <button type="button" className="linklike copy-csv" ref={ref} onClick={copy}>
        {text}
      </button>
      <span className="visually-hidden" role="status" aria-live="polite">
        {state === 'copied'
          ? 'Table copied to the clipboard as comma-separated values.'
          : state === 'failed'
            ? 'Copy failed: the browser blocked clipboard access. Select the table and copy it manually.'
            : ''}
      </span>
    </span>
  );
}
