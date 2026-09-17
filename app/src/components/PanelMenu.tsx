import { useEffect, useRef, useState } from 'react';

/** The panel's action menu (⋯, top right): copy the panel's table as CSV, and copy a link that
 *  opens this panel. It replaces the text link that sat under every table.
 *
 *  CSV serializes the rendered table (headers included, one row per row, values as displayed); a
 *  value shown as an em dash stays an em dash, and a leading =, +, - or @ is prefixed with an
 *  apostrophe so a spreadsheet treats it as text rather than a formula. The CSV item is hidden by
 *  CSS (`.panel:not(:has(table))`) where the panel holds no table. */

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

/** The current address with `p=<panel id>`, so the link opens the page, tab and fund on screen
 *  and scrolls to the panel. */
export function panelLink(id: string, href = window.location.href): string {
  const url = new URL(href);
  const [path, query = ''] = url.hash.replace(/^#/, '').split('?');
  const params = new URLSearchParams(query);
  params.set('p', id);
  url.hash = `#${path || '/'}?${params.toString()}`;
  return url.toString();
}

export function PanelMenu({ panelId }: { panelId?: string | undefined }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const [status, setStatus] = useState<'' | 'csv' | 'link' | 'failed' | 'empty'>('');

  useEffect(() => {
    if (!status) return;
    const t = setTimeout(() => setStatus(''), 2400);
    return () => clearTimeout(t);
  }, [status]);

  // close on an outside click or Escape, like any menu
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onDoc = (ev: MouseEvent) => {
      if (el.open && !el.contains(ev.target as Node)) el.open = false;
    };
    const onKey = (ev: globalThis.KeyboardEvent) => {
      if (el.open && ev.key === 'Escape') {
        el.open = false;
        el.querySelector('summary')?.focus();
      }
    };
    document.addEventListener('click', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  async function write(text: string, ok: 'csv' | 'link') {
    try {
      await navigator.clipboard.writeText(text);
      setStatus(ok);
    } catch {
      setStatus('failed');
    }
    if (ref.current) ref.current.open = false;
  }

  function copyCsv() {
    const table = ref.current?.closest('.panel')?.querySelector('table');
    if (!table) {
      setStatus('empty');
      return;
    }
    void write(tableToCsv(table as HTMLTableElement), 'csv');
  }

  const message =
    status === 'csv'
      ? 'Table copied as CSV'
      : status === 'link'
        ? 'Link copied'
        : status === 'failed'
          ? 'Copy blocked by the browser'
          : status === 'empty'
            ? 'No table in this panel'
            : '';

  return (
    <div className={`panel-menu-slot${panelId ? ' has-link' : ''}`}>
      <details className="panel-menu" ref={ref}>
        <summary aria-label="Panel actions" title="Panel actions">
          <span aria-hidden="true">⋯</span>
        </summary>
        <div className="panel-menu-list">
          <button type="button" className="pm-csv" onClick={copyCsv}>
            Copy table as CSV
          </button>
          {panelId ? (
            <button type="button" onClick={() => void write(panelLink(panelId), 'link')}>
              Copy link to this panel
            </button>
          ) : null}
        </div>
      </details>
      <span className={`panel-toast${message ? ' on' : ''}`} role="status" aria-live="polite">
        {message}
      </span>
    </div>
  );
}
