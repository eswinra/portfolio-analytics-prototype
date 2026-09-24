import { monthYear } from '../../fixtures/cioMonthly';
import { SERIES_KEYS, type CioHistory, type SeriesKey } from '../../lib/cioHistory';
import { figId, type FundKey } from '../../lib/provenance';
import { Fig } from '../Provenance';
import { shortMonth, signed1 } from './format';

/** Shade step for a one-month return: the number is always printed, so the shade only helps the
 *  eye find the large months (blue up, grey down — never colour alone). */
export function returnTone(r: number | null): string {
  if (r === null) return '';
  const a = Math.abs(r);
  const step = a < 0.5 ? 0 : a < 1.5 ? 1 : a < 3 ? 2 : 3;
  return step === 0 ? '' : ` x-${r > 0 ? 'pos' : 'neg'}-${step}`;
}

/** Categories as rows, months as columns: every one-month return the reports printed. A row
 *  header selects the category for the panels below; a month header opens that report (the same
 *  as the report slider above). A month without a report is marked, not filled. */
export function ReturnGrid({
  history,
  current,
  cat,
  onSelectCat,
  onSelectMonth,
  fund,
}: {
  /** the fund the history is for: its cells then open each figure's record */
  fund?: FundKey;
  history: CioHistory;
  /** index of the report on screen in `history.months`, or -1 */
  current: number;
  cat: SeriesKey;
  onSelectCat: (k: SeriesKey) => void;
  onSelectMonth: (monthEnd: string) => void;
}) {
  const { months, reports, series, labels } = history;
  return (
    <div
      className="table-scroll"
      role="region"
      aria-label="One-month return by category and month"
      tabIndex={0}
    >
      <table className="table x-grid">
        <caption>
          One-month net return by data month, % as each report printed it. Choose a category to
          follow it below; choose a month to open the report that covers it.
        </caption>
        <thead>
          <tr>
            <th scope="col">Category</th>
            {months.map((m, i) => (
              <th
                scope="col"
                key={m}
                className={`num${i === current ? ' x-col-sel' : ''}${reports[i] ? '' : ' x-gap'}`}
              >
                {reports[i] ? (
                  <button
                    type="button"
                    className="x-month"
                    aria-pressed={i === current}
                    aria-label={`Open the report with data through ${monthYear(m)}`}
                    onClick={() => onSelectMonth(m)}
                  >
                    {shortMonth(m)}
                  </button>
                ) : (
                  <span title={`No report carries ${monthYear(m)}`}>
                    {shortMonth(m)}
                    <span className="x-gap-note">no report</span>
                  </span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {SERIES_KEYS.map((k) => (
            <tr
              key={k}
              className={`${k === cat ? 'x-row-sel' : ''}${k === 'total' ? ' x-total' : ''}`}
            >
              <th scope="row">
                <button
                  type="button"
                  className="x-cat"
                  aria-pressed={k === cat}
                  onClick={() => onSelectCat(k)}
                >
                  {labels[k]}
                </button>
              </th>
              {series[k].map((p, i) => (
                <td
                  key={months[i]}
                  className={`num x-cell${returnTone(p.r)}${i === current ? ' x-col-sel' : ''}${
                    reports[i] ? '' : ' x-gap'
                  }`}
                >
                  {reports[i] ? (
                    fund ? (
                      <Fig
                        id={figId.at(
                          k === 'total' ? figId.r(fund, 0) : figId.compR(fund, k, 0),
                          reports[i],
                        )}
                      >
                        {signed1(p.r)}
                      </Fig>
                    ) : (
                      signed1(p.r)
                    )
                  ) : (
                    ''
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
