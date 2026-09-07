import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

import {
  CIO_LATEST,
  CIO_VINTAGES,
  priorVintage,
  vintageFromFeed,
  type CioVintage,
} from '../fixtures/cioMonthly';
import type { CioFeed } from './dataset/cioFeed';
import { useDataset } from './dataset/useDataset';

export const FEED_KEY = 'workstation';

/** The CIO Monthly vintage on screen lives in the URL (`#/cio?v=<data-through>`), so a month
 *  can be linked to and the masthead, notice bar and title band can show the same date as the
 *  panels. `v=workstation` selects the feed carried by an applied import (schema 1.4
 *  cio_monthly rows), when there is one. No parameter, or an unknown one, means the latest
 *  public report. */
export function useCioVintage(): {
  vintage: CioVintage;
  prior: CioVintage | null;
  isLatest: boolean;
  /** the applied import's feed when the selected vintage is the workstation dataset */
  feed: CioFeed | null;
  /** an applied import carries a feed (the option is offered) */
  feedAvailable: CioFeed | null;
  select: (key: string) => void;
} {
  const [params, setParams] = useSearchParams();
  const { dataset, source } = useDataset();
  const feedAvailable = source === 'import' ? dataset.cioFeed : null;
  const key = params.get('v');
  const feed = key === FEED_KEY && feedAvailable ? feedAvailable : null;
  const vintage = useMemo(
    () =>
      feed
        ? vintageFromFeed(feed)
        : (CIO_VINTAGES.find((v) => v.dataThrough === key) ?? CIO_LATEST),
    [feed, key],
  );
  const select = useCallback(
    (next: string) => {
      const p = new URLSearchParams(params);
      if (next === CIO_LATEST.dataThrough) p.delete('v');
      else p.set('v', next);
      setParams(p, { replace: true });
    },
    [params, setParams],
  );
  return {
    vintage,
    prior: priorVintage(vintage),
    isLatest: !feed && vintage === CIO_LATEST,
    feed,
    feedAvailable,
    select,
  };
}
