import { useEffect, useState } from 'react';

/** In-page navigation for the long views. Hash routing rules out fragment links, so these are
 *  buttons that scroll; the highlighted entry follows the panel nearest the top of the viewport.
 *  Sections whose panel is not rendered for the current selection are skipped, so the bar never
 *  offers a jump to something that is not there. */
export function SectionNav({ sections }: { sections: [id: string, label: string][] }) {
  const [active, setActive] = useState<string>(sections[0]?.[0] ?? '');
  const [present, setPresent] = useState<string[]>([]);

  useEffect(() => {
    const ids = sections.map(([id]) => id).filter((id) => document.getElementById(id));
    setPresent(ids);
    if (typeof IntersectionObserver !== 'function') return;
    const seen = new Map<string, number>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const en of entries) seen.set(en.target.id, en.intersectionRatio);
        const best = [...seen.entries()].filter(([, r]) => r > 0).sort((a, b) => b[1] - a[1])[0];
        if (best) setActive(best[0]);
      },
      { rootMargin: '-96px 0px -55% 0px', threshold: [0, 0.25, 0.6, 1] },
    );
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) io.observe(el);
    }
    return () => io.disconnect();
  }, [sections]);

  const shown = sections.filter(([id]) => present.includes(id));
  if (shown.length < 2) return null;
  return (
    <nav className="section-nav" aria-label="Sections on this page">
      {shown.map(([id, label]) => (
        <button
          type="button"
          key={id}
          className={active === id ? 'on' : ''}
          aria-current={active === id ? 'true' : undefined}
          onClick={() =>
            document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }
        >
          {label}
        </button>
      ))}
    </nav>
  );
}
