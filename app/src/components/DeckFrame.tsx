import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';

import { longDate, type CioVintage } from '../fixtures/cioMonthly';
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

export function DeckFrame({
  vintage,
  isLatest,
  feed,
}: {
  vintage: CioVintage;
  isLatest: boolean;
  feed: CioFeed | null;
}) {
  const { entity, setEntity } = useEntity();
  const [slideRaw, setSlide] = useUrlParam('slide', '1');
  const slide = Math.min(SLIDES, Math.max(1, Number.parseInt(slideRaw, 10) || 1));
  const frame = useRef<HTMLIFrameElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const scrolled = useRef(false);
  const data = useMemo(() => deckDataFor(vintage, { feed: Boolean(feed) }), [vintage, feed]);
  const frameKey = `${vintage.dataThrough}|${feed ? feed.entityId : 'public'}`;

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
    : `the ${vintage.reportLabel} report, data through ${longDate(vintage.dataThrough)}`;

  return (
    <section className="deck-present" aria-label="CIO Monthly Report slides">
      <div className="deck-toolbar">
        <span>
          Slides for <strong>{label}</strong> — built from the figures on the other tabs.
          {isLatest ? '' : ' Editorial pages exist for the latest report only.'}
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
            // bring the whole slide on screen the first time the tab opens, ready for the keys
            if (!scrolled.current) {
              wrap.current?.scrollIntoView({ block: 'start' });
              scrolled.current = true;
            }
            frame.current?.contentWindow?.focus();
          }}
        />
      </div>
      <p className="footnote">
        Click the slides, then use ← → to step through; E switches fund; N opens the speaker notes;
        P opens presenter view in a second window.
      </p>
    </section>
  );
}
