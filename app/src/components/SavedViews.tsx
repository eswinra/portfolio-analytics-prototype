import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

import { CIO_LATEST } from '../fixtures/cioMonthly';
import {
  deleteView,
  describeView,
  followsLatest,
  MAX_NAME_LENGTH,
  parseSavedViews,
  pinReport,
  restoreView,
  SAVED_VIEWS_KEY,
  savedOn,
  saveView,
  serializeSavedViews,
  unsaveableReason,
  viewVintage,
  type SavedView,
} from '../lib/savedViews';

/** Saved views (title band, every dashboard view): name the view on screen and come back to it.
 *  A saved view is its address and a name, kept in this browser's local storage; the rules —
 *  which addresses may be saved, how a view says which report it shows, how stored entries are
 *  checked — are in lib/savedViews.ts. Storage can be blocked (a private window, a policy); the
 *  list then lasts until the page is closed, and says so. */

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

interface Loaded {
  views: SavedView[];
  /** said once, under the list: storage blocked, unreadable, or entries left out */
  note: string;
}

function load(): Loaded {
  const s = storage();
  if (!s) return { views: [], note: BLOCKED };
  let raw: string | null;
  try {
    raw = s.getItem(SAVED_VIEWS_KEY);
  } catch {
    return { views: [], note: BLOCKED };
  }
  const parsed = parseSavedViews(raw);
  return {
    views: parsed.views,
    note: parsed.unreadable
      ? 'The saved views stored in this browser could not be read, so none are shown. Saving a view replaces them.'
      : parsed.dropped > 0
        ? `${parsed.dropped} stored ${parsed.dropped === 1 ? 'entry was' : 'entries were'} not a dashboard view and ${parsed.dropped === 1 ? 'was' : 'were'} left out.`
        : '',
  };
}

const BLOCKED =
  'This browser is not keeping data for this site, so saved views last only until the page is closed.';

function persist(views: SavedView[]): boolean {
  const s = storage();
  if (!s) return false;
  try {
    s.setItem(SAVED_VIEWS_KEY, serializeSavedViews(views));
    return true;
  } catch {
    return false;
  }
}

function newId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

type Status = { text: string; undo?: { view: SavedView; index: number } } | null;

export function SavedViews() {
  const { pathname, search } = useLocation();
  const href = `${pathname}${search}`;
  const ref = useRef<HTMLDetailsElement>(null);
  const [{ views, note }, setLoaded] = useState<Loaded>(load);
  // a name the reader typed; until then the field shows the saved name or the suggested one
  const [typed, setTyped] = useState<string | null>(null);
  const [pin, setPin] = useState(false);
  const [status, setStatus] = useState<Status>(null);

  const why = unsaveableReason(href);
  const latest = followsLatest(href);
  const target = pin ? pinReport(href) : href;
  const existing = views.find((v) => v.href === target);
  const shownName = typed ?? existing?.name ?? describeView(target);

  // a new address is a new view to name, and the menu does not follow the reader to it
  useEffect(() => {
    setTyped(null);
    setPin(false);
    setStatus(null);
    if (ref.current) ref.current.open = false;
  }, [href]);

  // another tab saved or deleted a view
  useEffect(() => {
    const onStorage = (ev: StorageEvent) => {
      if (ev.key === SAVED_VIEWS_KEY) setLoaded(load());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const close = useCallback(() => {
    if (ref.current) ref.current.open = false;
  }, []);

  // close on an outside click or Escape, like the panel menus
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // the path is fixed when the click happens: Delete and Undo remove the button that was
    // clicked before this runs, and a removed button would otherwise count as outside the menu
    const onDoc = (ev: MouseEvent) => {
      if (el.open && !ev.composedPath().includes(el)) el.open = false;
    };
    const onKey = (ev: KeyboardEvent) => {
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

  const commit = (next: SavedView[], text: string) => {
    const kept = persist(next);
    setLoaded((l) => ({ views: next, note: kept ? (l.note === BLOCKED ? '' : l.note) : BLOCKED }));
    setStatus({ text });
  };

  const save = () => {
    const r = saveView(views, {
      id: newId(),
      name: shownName,
      href: target,
      savedAt: new Date().toISOString(),
    });
    if (!r.ok) {
      setStatus({ text: r.reason });
      return;
    }
    const saved = r.views[0]!;
    commit(r.views, r.replaced ? `Renamed to “${saved.name}”.` : `Saved “${saved.name}”.`);
    setTyped(null);
  };

  const remove = (v: SavedView) => {
    const index = views.indexOf(v);
    const next = deleteView(views, v.id);
    const kept = persist(next);
    setLoaded((l) => ({ views: next, note: kept ? l.note : BLOCKED }));
    setStatus({ text: `Deleted “${v.name}”.`, undo: { view: v, index } });
  };

  const undo = () => {
    if (!status?.undo) return;
    const next = restoreView(views, status.undo.view, status.undo.index);
    commit(next, `Restored “${status.undo.view.name}”.`);
  };

  const copy = async (v: SavedView) => {
    const url = `${window.location.origin}${window.location.pathname}#${v.href}`;
    try {
      await navigator.clipboard.writeText(url);
      setStatus({ text: `Link to “${v.name}” copied.` });
    } catch {
      setStatus({ text: 'The browser blocked copying; open the view and copy the address bar.' });
    }
  };

  return (
    <details
      className="saved-views"
      ref={ref}
      onToggle={() => {
        // the list may have changed in another tab since the page loaded
        if (ref.current?.open) setLoaded(load());
      }}
    >
      <summary className="btn-band">
        Saved views{views.length > 0 ? ` (${views.length})` : ''}
      </summary>
      <div className="sv-pop">
        {why ? (
          <p className="sv-why">{why}</p>
        ) : (
          <form
            className="sv-save"
            onSubmit={(ev) => {
              ev.preventDefault();
              save();
            }}
          >
            <label htmlFor="sv-name">
              {existing ? 'This view is saved as' : 'Name for this view'}
            </label>
            <input
              id="sv-name"
              type="text"
              value={shownName}
              maxLength={MAX_NAME_LENGTH}
              onChange={(ev) => setTyped(ev.target.value)}
            />
            {latest ? (
              <label className="sv-pin">
                <input
                  type="checkbox"
                  checked={pin}
                  onChange={(ev) => {
                    setPin(ev.target.checked);
                    setTyped(null);
                  }}
                />{' '}
                Keep the {CIO_LATEST.reportLabel} report, rather than whichever report is latest
                when the view is opened
              </label>
            ) : null}
            <button type="submit" className="btn-outline">
              {existing ? 'Rename' : 'Save this view'}
            </button>
          </form>
        )}

        {views.length === 0 ? (
          <p className="sv-empty">No saved views in this browser yet.</p>
        ) : (
          <ul className="sv-list" aria-label="Saved views">
            {views.map((v) => (
              <li key={v.id}>
                <Link
                  to={v.href}
                  className="sv-open"
                  aria-current={v.href === href ? 'page' : undefined}
                  onClick={close}
                >
                  {v.name}
                </Link>
                <span className="sv-meta">
                  {[viewVintage(v.href), `saved ${savedOn(v.savedAt)}`].filter(Boolean).join(' · ')}
                </span>
                <span className="sv-acts">
                  <button
                    type="button"
                    className="linklike"
                    aria-label={`Copy link to ${v.name}`}
                    onClick={() => void copy(v)}
                  >
                    Copy link
                  </button>
                  <button
                    type="button"
                    className="linklike"
                    aria-label={`Delete ${v.name}`}
                    onClick={() => remove(v)}
                  >
                    Delete
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}

        <p className="sv-status" role="status">
          {status?.text}
          {status?.undo ? (
            <>
              {' '}
              <button type="button" className="linklike" onClick={undo}>
                Undo
              </button>
            </>
          ) : null}
        </p>
        <p className="sv-note">
          Kept in this browser only; nothing is sent anywhere. A saved view is an address: it
          reopens the page, fund, report and settings, with the figures the site has when it is
          opened.
        </p>
        {note ? <p className="sv-note">{note}</p> : null}
      </div>
    </details>
  );
}
