import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type ReactNode,
  type RefObject,
} from 'react';

import { ClassBadge, CLASS_DEFINITIONS } from './ui';
import {
  resolveFigure,
  whenText,
  type Provenance,
  type ProvenanceContext,
} from '../lib/provenance';
import { useUrlParam } from '../lib/urlState';

/** The provenance drawer: select a figure and see where it came from — the document and page,
 *  how it is classified, how it was calculated (each input opens its own record), and when it
 *  was true. The figure's address is in the URL (`?fig=`), so a link opens the same record.
 *
 *  Built on the native <dialog>: showModal() keeps focus inside and the page behind it inert,
 *  and focus goes back to the figure that opened it. Escape is handled here rather than left to
 *  the browser, whose own Escape-to-close is subject to rules about user activation that differ
 *  between browsers and did not fire for scripted key presses when this was tested. */

const FigureContext = createContext<((id: string) => void) | null>(null);
const HINT_ID = 'fig-hint';

/** A figure a reader can select. Outside a provider it is plain text, so a component that
 *  shows figures works the same on a page without the drawer. */
export function Fig({ id, children }: { id: string; children: ReactNode }) {
  const open = useContext(FigureContext);
  if (!open) return <>{children}</>;
  return (
    <button
      type="button"
      className="fig"
      data-fig={id}
      aria-haspopup="dialog"
      aria-describedby={HINT_ID}
      onClick={() => open(id)}
    >
      {children}
    </button>
  );
}

/** The region whose figures open the drawer. It renders that region's own element (a div taking
 *  any div attributes), so a page makes its existing container the provider rather than adding a
 *  wrapper around it. */
export function FigureProvenance({
  ctx,
  children,
  ...region
}: {
  ctx: ProvenanceContext;
  children: ReactNode;
} & ComponentPropsWithoutRef<'div'>) {
  const [fig, setFig] = useUrlParam('fig', '');
  // figures opened from inside the drawer, so Back retraces the path through the inputs
  const [trail, setTrail] = useState<string[]>([]);
  const opener = useRef<HTMLElement | null>(null);

  const open = useCallback(
    (id: string) => {
      opener.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setTrail([]);
      setFig(id);
    },
    [setFig],
  );
  const close = useCallback(() => {
    setTrail([]);
    setFig('');
    opener.current?.focus();
    opener.current = null;
  }, [setFig]);
  const go = (id: string) => {
    setTrail((t) => [...t, fig]);
    setFig(id);
  };
  const back = () => {
    const prev = trail.at(-1);
    if (prev === undefined) return;
    setTrail((t) => t.slice(0, -1));
    setFig(prev);
  };

  const prevId = trail.at(-1);
  const prev = prevId ? resolveFigure(prevId, ctx) : null;

  return (
    <FigureContext.Provider value={open}>
      <div {...region}>{children}</div>
      <p id={HINT_ID} hidden>
        Shows where this figure came from: its source page, classification, how it was calculated
        and when it was true.
      </p>
      <ProvenanceDialog
        id={fig}
        ctx={ctx}
        onClose={close}
        onGo={go}
        {...(prev
          ? { onBack: back, backLabel: prev.ok ? prev.fig.label : 'the previous figure' }
          : {})}
      />
    </FigureContext.Provider>
  );
}

function ProvenanceDialog({
  id,
  ctx,
  onClose,
  onGo,
  onBack,
  backLabel,
}: {
  id: string;
  ctx: ProvenanceContext;
  onClose: () => void;
  onGo: (id: string) => void;
  onBack?: () => void;
  backLabel?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const res = useMemo(() => (id ? resolveFigure(id, ctx) : null), [id, ctx]);
  const [copied, setCopied] = useState<'' | 'done' | 'failed'>('');

  // the address decides whether the drawer is open: a pasted link opens it, closing clears it
  useEffect(() => {
    const d = ref.current;
    if (!d || typeof d.showModal !== 'function') return;
    if (id && !d.open) d.showModal();
    if (!id && d.open) d.close();
  }, [id]);

  // moving to another figure inside the drawer announces it
  useEffect(() => {
    setCopied('');
    if (id && ref.current?.open) title.current?.focus();
  }, [id]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied('done');
    } catch {
      setCopied('failed');
    }
  };

  return (
    <dialog
      ref={ref}
      className="prov"
      aria-labelledby="prov-title"
      onClose={onClose}
      onKeyDown={(ev) => {
        if (ev.key !== 'Escape') return;
        ev.preventDefault();
        ref.current?.close();
      }}
      onClick={(ev) => {
        // a click on the backdrop lands on the dialog itself; the content fills it otherwise
        if (ev.target === ref.current) ref.current.close();
      }}
    >
      <div className="prov-inner">
        <button
          type="button"
          className="prov-close"
          aria-label="Close"
          onClick={() => ref.current?.close()}
        >
          ×
        </button>
        {res === null ? null : res.ok ? (
          <Record
            fig={res.fig}
            titleRef={title}
            onGo={onGo}
            {...(onBack ? { onBack, backLabel: backLabel ?? '' } : {})}
          />
        ) : (
          <>
            <div className="prov-kicker">Figure not found</div>
            <h2 id="prov-title" ref={title} tabIndex={-1}>
              Nothing on this page has that address
            </h2>
            <p className="prov-read">{res.reason}</p>
            <p className="prov-read">
              The link may come from another report or an earlier version of the page. Close this to
              carry on; every figure on the page can still be selected.
            </p>
          </>
        )}
        {res?.ok ? (
          <div className="prov-foot">
            <button type="button" className="btn-outline" onClick={() => void copy()}>
              Copy link to this figure
            </button>
            <span role="status" className="prov-copied">
              {copied === 'done'
                ? 'Link copied'
                : copied === 'failed'
                  ? 'Could not copy — the address bar has the link'
                  : ''}
            </span>
          </div>
        ) : null}
      </div>
    </dialog>
  );
}

function Record({
  fig,
  titleRef,
  onGo,
  onBack,
  backLabel,
}: {
  fig: Provenance;
  titleRef: RefObject<HTMLHeadingElement>;
  onGo: (id: string) => void;
  onBack?: () => void;
  backLabel?: string;
}) {
  const calculated = fig.formula !== undefined;
  return (
    <>
      {onBack ? (
        <button type="button" className="linklike prov-back" onClick={onBack}>
          ← Back to {backLabel}
        </button>
      ) : null}
      <div className="prov-kicker">
        {fig.fund} · {fig.report}
      </div>
      <h2 id="prov-title" ref={titleRef} tabIndex={-1}>
        {fig.label}
      </h2>
      <div className="prov-value">{fig.display}</div>
      <div className="prov-cls">
        <ClassBadge c={fig.cls} always />
        <span>{CLASS_DEFINITIONS[fig.cls]}</span>
      </div>

      <section className="prov-sec">
        <h3>Where it came from</h3>
        <ul className="prov-sources">
          {fig.sources.map((s) => (
            <li key={s.id}>
              {s.url ? (
                <a href={s.url} target="_blank" rel="noreferrer">
                  {s.label}
                </a>
              ) : (
                <strong>{s.label}</strong>
              )}
              <span>
                {s.doc} — {s.pageTable} · as of {s.asOf}
              </span>
            </li>
          ))}
        </ul>
        {calculated
          ? null
          : fig.read.map((r) => (
              <p className="prov-read" key={r}>
                {r}
              </p>
            ))}
      </section>

      {calculated ? (
        <section className="prov-sec">
          <h3>How it was calculated</h3>
          <p>{fig.formula}</p>
          {fig.worked ? <p className="prov-worked">{fig.worked}</p> : null}
          {fig.read.map((r) => (
            <p className="prov-read" key={r}>
              {r}
            </p>
          ))}
          {fig.inputs.length > 0 ? (
            <ul className="prov-inputs" aria-label="Calculated from">
              {fig.inputs.map((i) => (
                <li key={i.id}>
                  <button type="button" className="linklike" onClick={() => onGo(i.id)}>
                    {i.label}
                  </button>
                  <span className="prov-in-v">{i.display}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      <section className="prov-sec">
        <h3>When it was true</h3>
        <p>{whenText(fig.when)}</p>
      </section>

      {fig.notes.length > 0 ? (
        <section className="prov-sec">
          <h3>Read it with</h3>
          <ul className="prov-notes">
            {fig.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
