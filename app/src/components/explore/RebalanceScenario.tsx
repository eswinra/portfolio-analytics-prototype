import { useId } from 'react';

import type { CioEntity, CompositeKey } from '../../fixtures/cioMonthly';
import { CATEGORY_KEYS, rebalance, type Band } from '../../lib/cioHistory';
import { moneyM, pct1 } from './format';

const toNumber = (s: string | undefined) =>
  s === undefined || s.trim() === '' ? Number.NaN : Number(s);

/** What it would take to move the fund from its reported weights to targets the reader enters:
 *  dollars per category from the report's month-end market values. The entries live in the
 *  address, so a scenario can be shared as a link. Arithmetic only — the panel says what it is
 *  not (a recommendation, a trade plan) and flags a target outside the policy range. */
export function RebalanceScenario({
  e,
  monthLabel,
  bands,
  entries,
  onChange,
  onReset,
}: {
  e: CioEntity;
  monthLabel: string;
  bands: Partial<Record<CompositeKey, Band>>;
  /** the reader's targets as typed (strings, so a half-typed entry is kept as it is) */
  entries: Record<CompositeKey, string>;
  onChange: (k: CompositeKey, v: string) => void;
  onReset: () => void;
}) {
  const proposed = Object.fromEntries(
    CATEGORY_KEYS.map((k) => [k, toNumber(entries[k])]),
  ) as Record<CompositeKey, number>;
  const res = rebalance(e, proposed, bands);
  const typedSum = CATEGORY_KEYS.reduce((s, k) => s + (toNumber(entries[k]) || 0), 0);
  const printed = (k: CompositeKey) => e.comps.find((c) => c.k === k)?.tgt;
  const changed = CATEGORY_KEYS.some((k) => toNumber(entries[k]) !== printed(k));
  const uid = useId();

  return (
    <div className="x-scenario">
      <fieldset className="x-targets">
        <legend>Proposed targets, % of the fund</legend>
        {CATEGORY_KEYS.map((k) => {
          const c = e.comps.find((x) => x.k === k);
          const band = bands[k];
          return (
            <div key={k} className="x-target-field">
              <label className="x-target-name" htmlFor={`${uid}-${k}`}>
                {c?.short ?? k}
              </label>
              <input
                id={`${uid}-${k}`}
                aria-describedby={`${uid}-${k}-hint`}
                type="number"
                inputMode="decimal"
                min={0}
                max={100}
                step={0.5}
                value={entries[k]}
                onChange={(ev) => onChange(k, ev.target.value)}
              />
              <span className="x-target-hint" id={`${uid}-${k}-hint`}>
                report {pct1(c?.tgt)}
                {band ? ` · range ${band.min}–${band.max}%` : ''}
              </span>
            </div>
          );
        })}
        <div className="x-target-sum" aria-live="polite">
          Adds to <strong>{typedSum.toFixed(1)}%</strong>
          {Math.abs(typedSum - 100) > 0.05 ? ' — needs 100%' : ''}
        </div>
        <button type="button" className="btn-outline" onClick={onReset} disabled={!changed}>
          Reset to the report&apos;s targets
        </button>
      </fieldset>

      <div aria-live="polite">
        {res.ok ? (
          <>
            <div
              className="table-scroll"
              role="region"
              aria-label="Amounts to reach the proposed targets"
              tabIndex={0}
            >
              <table className="table">
                <caption>
                  {`Amounts to reach the proposed targets from the ${monthLabel} market values (${moneyM(res.base)}, the lines below added up)`}
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Line</th>
                    <th scope="col" className="num">
                      Market value
                    </th>
                    <th scope="col" className="num">
                      Weight
                    </th>
                    <th scope="col" className="num">
                      Report target
                    </th>
                    <th scope="col" className="num">
                      Proposed
                    </th>
                    <th scope="col" className="num">
                      To reach it
                    </th>
                    <th scope="col">Policy range</th>
                  </tr>
                </thead>
                <tbody>
                  {res.lines.map((l) => (
                    <tr key={l.key}>
                      <td>{l.label}</td>
                      <td className="num">{moneyM(l.mv)}</td>
                      <td className="num">{pct1(l.weight)}</td>
                      <td className="num">{l.target === null ? '—' : pct1(l.target)}</td>
                      <td className="num">{pct1(l.proposed)}</td>
                      <td className="num" style={{ fontWeight: 600 }}>
                        {Math.round(l.change) === 0
                          ? '—'
                          : `${l.change > 0 ? 'buy ' : 'sell '}${moneyM(Math.abs(l.change))}`}
                      </td>
                      <td>
                        {l.key === 'other'
                          ? 'no policy weight — a source of funds'
                          : l.band
                            ? `${l.band.min}–${l.band.max}%${
                                l.outsideBand ? ' — proposed target is outside it' : ''
                              }`
                            : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="x-lede">
              {res.buys < 0.5
                ? 'The proposed targets match the fund as it stood: nothing would move.'
                : `${moneyM(res.buys)} bought and ${moneyM(res.sells)} sold — ${((res.buys / res.base) * 100).toFixed(1)}% of the fund changing hands.`}
              {res.lines.some((l) => l.outsideBand)
                ? ' A proposed target outside the policy range would need a change to the Investment Policy Statement first.'
                : ''}
            </p>
          </>
        ) : (
          <div className="x-problems">
            <strong>No amounts yet.</strong>
            <ul>
              {res.problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
