import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

/** View state that belongs in the address bar: the fund, the selected report, and the toggles
 *  that change what a panel shows. A pasted link must reproduce what the sender was looking at,
 *  so these live in the query string rather than in component state. Defaults are omitted from
 *  the URL, which keeps the common case clean. */
export function useUrlParam(key: string, fallback: string): [string, (next: string) => void] {
  const [params, setParams] = useSearchParams();
  const value = params.get(key) ?? fallback;
  const set = useCallback(
    (next: string) => {
      const p = new URLSearchParams(params);
      if (next === fallback) p.delete(key);
      else p.set(key, next);
      setParams(p, { replace: true });
    },
    [params, setParams, key, fallback],
  );
  return [value, set];
}

/** Boolean flag in the URL (`?compare=1`). */
export function useUrlFlag(key: string): [boolean, (next: boolean) => void] {
  const [raw, setRaw] = useUrlParam(key, '');
  const set = useCallback((next: boolean) => setRaw(next ? '1' : ''), [setRaw]);
  return [raw === '1', set];
}
