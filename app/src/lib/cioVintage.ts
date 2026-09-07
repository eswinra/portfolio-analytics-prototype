import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

import { CIO_LATEST, CIO_VINTAGES, priorVintage, type CioVintage } from '../fixtures/cioMonthly';

/** The CIO Monthly vintage on screen lives in the URL (`#/cio?v=<data-through>`), so a month
 *  can be linked to and the masthead, notice bar and title band can show the same date as the
 *  panels. No parameter, or an unknown one, means the latest report. */
export function useCioVintage(): {
  vintage: CioVintage;
  prior: CioVintage | null;
  isLatest: boolean;
  select: (dataThrough: string) => void;
} {
  const [params, setParams] = useSearchParams();
  const key = params.get('v');
  const vintage = CIO_VINTAGES.find((v) => v.dataThrough === key) ?? CIO_LATEST;
  const select = useCallback(
    (dataThrough: string) => {
      const next = new URLSearchParams(params);
      if (dataThrough === CIO_LATEST.dataThrough) next.delete('v');
      else next.set('v', dataThrough);
      setParams(next, { replace: true });
    },
    [params, setParams],
  );
  return { vintage, prior: priorVintage(vintage), isLatest: vintage === CIO_LATEST, select };
}
