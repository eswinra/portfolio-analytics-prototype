import { useEffect, useRef, useState } from 'react';

/** Plays through the published reports, one step every `stepMs`: from the first report when
 *  started at the latest, from the report on screen otherwise, stopping at the latest. The page
 *  follows the report on screen, so every panel and the slides move with it. Pause stops it;
 *  choosing a report by hand while it plays carries on from there. Discrete steps started by the
 *  reader, so it runs under reduced motion too (the panels themselves then do not animate). */
export function ReportPlayer({
  index,
  count,
  onStep,
  nowShowing,
  disabled,
  stepMs = 1600,
}: {
  /** the report on screen, 0 = oldest */
  index: number;
  count: number;
  onStep: (index: number) => void;
  /** what a screen reader hears at each step, e.g. "March 2026 data" */
  nowShowing: string;
  disabled: boolean;
  stepMs?: number;
}) {
  const [playing, setPlaying] = useState(false);
  const indexRef = useRef(index);
  const stepRef = useRef(onStep);
  indexRef.current = index;
  stepRef.current = onStep;

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      const next = indexRef.current + 1;
      if (next >= count) {
        setPlaying(false);
        return;
      }
      stepRef.current(next);
      if (next === count - 1) setPlaying(false);
    }, stepMs);
    return () => window.clearInterval(id);
  }, [playing, count, stepMs]);

  useEffect(() => {
    if (disabled) setPlaying(false);
  }, [disabled]);

  const start = () => {
    if (index < 0 || index >= count - 1) stepRef.current(0);
    setPlaying(true);
  };

  return (
    <>
      <button
        type="button"
        className="btn-outline vs-play"
        disabled={disabled}
        onClick={() => (playing ? setPlaying(false) : start())}
      >
        <span className="vs-play-icon" aria-hidden="true">
          {playing ? '❚❚' : '▶'}
        </span>
        {playing ? 'Pause' : 'Play the reports'}
      </button>
      <span className="visually-hidden" aria-live="polite">
        {playing ? nowShowing : ''}
      </span>
    </>
  );
}
