import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';

import { longDate, type CioVintage } from '../fixtures/cioMonthly';
import type { CioPackage } from '../lib/cioPackage';
import type { CioFeed } from '../lib/dataset/cioFeed';
import { DECK_FEED_KEY, deckDataFor } from '../lib/deckFeed';
import { useEntity } from '../lib/entity';
import { useUrlParam } from '../lib/urlState';

/** The CIO Monthly slides, presented inside the dashboard exactly as the standalone deck
 *  presents them — the same page, in a frame — but fed by the dashboard: the frame loads with the
 *  report selected on the tab (or the imported workstation feed), and the fund toggle and the
 *  slide number stay in step both ways. Changing the report reloads the slides with its figures. */

const SLIDES = 9;

type FeedWindow = Window & { [DECK_FEED_KEY]?: unknown };

/** Keys the page passes to the slides when nothing on the page is using them. */
const PAGE_KEYS: Record<string, 'next' | 'prev'> = {
  ArrowRight: 'next',
  PageDown: 'next',
  ArrowLeft: 'prev',
  PageUp: 'prev',
};
const INTERACTIVE =
  'input, select, textarea, button, a, summary, [role="tab"], [role="slider"], [contenteditable], [tabindex]:not([tabindex="-1"])';

export function DeckFrame({
  vintage,
  isLatest,
  feed,
  pkg = null,
  loaded = 0,
  intent = false,
}: {
  vintage: CioVintage;
  isLatest: boolean;
  feed: CioFeed | null;
  /** a template file open on this page (read in the browser, not published) */
  pkg?: CioPackage | null;
  /** how many files have been opened: a new file reloads the slides */
  loaded?: number;
  /** the reader asked for the slides (chose the tab or a slide link): scroll them into place and
   *  give them the keyboard; opening CIO Monthly itself leaves the page where it is */
  intent?: boolean;
}) {
  const { entity, setEntity } = useEntity();
  const [slideRaw, setSlide] = useUrlParam('slide', '1');
  const slide = Math.min(SLIDES, Math.max(1, Number.parseInt(slideRaw, 10) || 1));
  const frame = useRef<HTMLIFrameElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const scrolled = useRef(false);
  const [params] = useSearchParams();
  const linked = useRef(params.has('slide'));
  const data = useMemo(
    () => deckDataFor(vintage, { feed: Boolean(feed), pkg }),
    [vintage, feed, pkg],
  );
  const frameKey = `${vintage.dataThrough}|${feed ? feed.entityId : pkg ? `file ${loaded}` : 'public'}`;

  // the deck reads its data from this window when its script starts, so it is set first
  useLayoutEffect(() => {
    (window as FeedWindow)[DECK_FEED_KEY] = data;
  }, [data]);
  useEffect(
    () => () => {
      delete (window as FeedWindow)[DECK_FEED_KEY];
    },
    [],
  );

  // the address the frame loads, fixed per report so slide changes do not reload it
  const deckEntity = entity === 'OPEB' ? 'opeb' : 'pension';
  const firstLoad = useRef({ slide, deckEntity });
  firstLoad.current = { slide, deckEntity };
  const src = useMemo(
    () =>
      `deck/index.html?embed=1&entity=${firstLoad.current.deckEntity}#${firstLoad.current.slide}`,
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload only when the report changes
    [frameKey],
  );

  // dashboard → slides: the fund toggle in the header switches the slides
  useEffect(() => {
    frame.current?.contentWindow?.postMessage(
      { type: 'lacera-deck-entity', entity: deckEntity },
      window.location.origin,
    );
  }, [deckEntity]);

  // dashboard → slides: a "Slide n" link on another tab moves the open deck
  useEffect(() => {
    frame.current?.contentWindow?.postMessage(
      { type: 'lacera-deck-go', slide },
      window.location.origin,
    );
  }, [slide]);

  // page → slides: ← → on the page step the slides without clicking into them first
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      const step = PAGE_KEYS[ev.key];
      if (!step || ev.defaultPrevented || ev.altKey || ev.ctrlKey || ev.metaKey) return;
      const target = ev.target as HTMLElement | null;
      if (target?.closest?.(INTERACTIVE)) return;
      ev.preventDefault();
      frame.current?.contentWindow?.postMessage(
        { type: 'lacera-deck-key', step },
        window.location.origin,
      );
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // slides → dashboard: E in the deck switches the dashboard's fund; the slide goes in the URL
  useEffect(() => {
    const onMessage = (ev: MessageEvent) => {
      if (ev.origin !== window.location.origin) return;
      if (ev.source !== frame.current?.contentWindow) return;
      const m = ev.data as { type?: string; slide?: unknown; entity?: unknown } | null;
      if (!m || m.type !== 'lacera-deck-state') return;
      if (!feed && (m.entity === 'opeb' || m.entity === 'pension')) {
        const next = m.entity === 'opeb' ? 'OPEB' : 'PENSION';
        if (next !== entity) setEntity(next);
      }
      if (typeof m.slide === 'number' && m.slide !== slide) setSlide(String(m.slide));
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [entity, setEntity, slide, setSlide, feed]);

  const label = feed
    ? `the workstation dataset (${feed.entityId}), data through ${longDate(feed.asOf)}`
    : pkg
      ? `the template file ${pkg.fileName} (not published), data through ${longDate(vintage.dataThrough)}`
      : `the ${vintage.reportLabel} report, data through ${longDate(vintage.dataThrough)}`;

  return (
    <section className="deck-present" aria-label="CIO Monthly Report slides">
      <div className="deck-toolbar">
        <span>
          Slides for <strong>{label}</strong> — built from the figures on the other tabs.
          {isLatest || pkg ? '' : ' Editorial pages exist for the latest report only.'}
        </span>
        <span className="deck-actions">
          <button
            type="button"
            className="btn-outline"
            onClick={() => void frame.current?.requestFullscreen?.()}
          >
            Full screen
          </button>
          <a className="btn-outline" href="deck/" target="_blank" rel="noreferrer">
            Standalone deck (latest report) ↗
          </a>
        </span>
      </div>
      <div className="deck-frame-wrap" ref={wrap}>
        <iframe
          key={frameKey}
          ref={frame}
          src={src}
          title={`CIO Monthly Report slides — ${label}`}
          allow="fullscreen"
          onLoad={() => {
            // when the reader asked for the slides, bring the whole slide on screen, ready for keys
            if (!scrolled.current && (intent || linked.current)) {
              wrap.current?.scrollIntoView({ block: 'start' });
              frame.current?.contentWindow?.focus();
            }
            scrolled.current = true;
          }}
        />
      </div>
      <p className="footnote">
        ← → step through the slides; E switches fund, N opens the speaker notes and P opens
        presenter view once the slides have been clicked. Full screen presents them alone.
      </p>
    </section>
  );
}
