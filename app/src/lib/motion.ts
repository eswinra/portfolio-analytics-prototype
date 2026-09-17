import { useEffect, useRef, useState, useSyncExternalStore, type RefObject } from 'react';

/** Motion helpers. Motion here only ever shows a change — a bar growing to its new value, a line
 *  moving from the old fund to the new one — and every helper stands still when the reader has
 *  asked the system for reduced motion. Nothing counts up from zero: an intermediate number that
 *  was never reported is never displayed as text. */

const QUERY = '(prefers-reduced-motion: reduce)';

function subscribe(onChange: () => void) {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {};
  const mq = window.matchMedia(QUERY);
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}

const readReduced = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia(QUERY).matches;

export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, readReduced, () => true);
}

export const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);

/** Interpolates each position of `from` toward `to`; a missing value on either side is not
 *  interpolated (the gap stays a gap). */
export function interpolate(
  from: readonly (number | null)[],
  to: readonly (number | null)[],
  k: number,
): (number | null)[] {
  return to.map((v, i) => {
    const a = from[i];
    return v === null || a === null || a === undefined ? v : a + (v - a) * k;
  });
}

/** Series values that move to their new positions over `duration` ms instead of jumping. A
 *  change of length (a different series or range) jumps; so does everything under reduced
 *  motion. Used for SVG geometry only — displayed numbers always show the target value. */
export function useTween(target: readonly (number | null)[], duration = 360): (number | null)[] {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState<(number | null)[]>(() => [...target]);
  const current = useRef<(number | null)[]>([...target]);
  const latest = useRef(target);
  latest.current = target;
  const key = target.map((v) => (v === null ? 'n' : v.toFixed(5))).join(',');

  useEffect(() => {
    const to = latest.current;
    const from = current.current;
    if (reduced || from.length !== to.length) {
      current.current = [...to];
      setShown([...to]);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / duration);
      const next = interpolate(from, to, easeOutCubic(k));
      current.current = next;
      setShown(next);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [key, reduced, duration]);

  return shown;
}

/** True once the element has scrolled into view (and stays true). Without IntersectionObserver
 *  (tests, old browsers) it is true from the start. */
export function useInView<T extends Element>(ref: RefObject<T>, rootMargin = '0px 0px -12% 0px') {
  const [seen, setSeen] = useState(() => typeof IntersectionObserver !== 'function');
  useEffect(() => {
    const el = ref.current;
    if (seen || !el || typeof IntersectionObserver !== 'function') return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setSeen(true);
          io.disconnect();
        }
      },
      { rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref, seen, rootMargin]);
  return seen;
}
