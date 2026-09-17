import { useRef, type KeyboardEvent } from 'react';

/** Sub-tabs for the long views. The selected tab lives in the URL (`?tab=`), so a link opens the
 *  same part of the page. Arrow keys move between tabs (roving tab index, WAI-ARIA tabs pattern);
 *  the panel below carries `role="tabpanel"`. */
export function SubTabs({
  tabs,
  value,
  onChange,
  label,
}: {
  tabs: [key: string, label: string][];
  value: string;
  onChange: (key: string) => void;
  label: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const index = Math.max(
    0,
    tabs.findIndex(([k]) => k === value),
  );

  function onKey(ev: KeyboardEvent<HTMLButtonElement>) {
    const last = tabs.length - 1;
    const next =
      ev.key === 'ArrowRight'
        ? index === last
          ? 0
          : index + 1
        : ev.key === 'ArrowLeft'
          ? index === 0
            ? last
            : index - 1
          : ev.key === 'Home'
            ? 0
            : ev.key === 'End'
              ? last
              : null;
    if (next === null) return;
    ev.preventDefault();
    onChange(tabs[next]![0]);
    refs.current[next]?.focus();
  }

  return (
    <div className="subtabs" role="tablist" aria-label={label}>
      {tabs.map(([key, text], i) => (
        <button
          key={key}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="button"
          role="tab"
          id={`subtab-${key}`}
          aria-selected={i === index}
          aria-controls="subtab-panel"
          tabIndex={i === index ? 0 : -1}
          className={i === index ? 'on' : ''}
          onClick={() => onChange(key)}
          onKeyDown={onKey}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

/** Scrolls a panel into view once the tab that holds it has rendered. */
export function scrollToPanel(id: string) {
  const run = () =>
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  requestAnimationFrame(() => requestAnimationFrame(run));
}
