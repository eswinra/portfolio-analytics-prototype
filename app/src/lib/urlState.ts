import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

/** View state that belongs in the address bar: the fund, the selected report, and the toggles
 *  that change what a panel shows. A pasted link must reproduce what the sender was looking at,
 *  so these live in the query string rather than in component state. Defaults are omitted from
 *  the URL, which keeps the common case clean.
 *
 *  React Router applies URL updates as a transition, so a control bound only to the URL would
 *  snap back for a moment before its new value arrived. The value just set is shown at once and
 *  held until the address has caught up with it (or moves on); the address stays the record. */
export function useUrlParam(key: string, fallback: string): [string, (next: string) => void] {
  const [params, setParams] = useSearchParams();
  const fromUrl = params.get(key) ?? fallback;
  // the value just set, and the address value it was set against
  const [pending, setPending] = useState<{ v: string; base: string } | null>(null);
  const value = pending && pending.base === fromUrl ? pending.v : fromUrl;
  // once the address has moved off that value — to the one set, or anywhere else — the address is
  // the record again. Kept, a pending value came back whenever a link returned the address to the
  // old value: a link to /cio without `cat` showed the category chosen before it.
  useEffect(() => {
    if (pending && pending.base !== fromUrl) setPending(null);
  }, [pending, fromUrl]);
  const set = useCallback(
    (next: string) => {
      setPending({ v: next, base: fromUrl });
      setParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          if (next === fallback) p.delete(key);
          else p.set(key, next);
          return p;
        },
        { replace: true },
      );
    },
    [fromUrl, setParams, key, fallback],
  );
  return [value, set];
}

/** Boolean flag in the URL (`?compare=1`). */
export function useUrlFlag(key: string): [boolean, (next: boolean) => void] {
  const [raw, setRaw] = useUrlParam(key, '');
  const set = useCallback((next: boolean) => setRaw(next ? '1' : ''), [setRaw]);
  return [raw === '1', set];
}
