import { useMemo } from 'react';

import { CategoryTrend } from '../components/explore/CategoryTrend';
import { CorrelationMap, parsePair, type Pair } from '../components/explore/CorrelationMap';
import { RebalanceScenario } from '../components/explore/RebalanceScenario';
import { ReturnGrid } from '../components/explore/ReturnGrid';
import { ClassBadge, Panel, SourceLine } from '../components/ui';
import {
  CIO_VINTAGES,
  cioFor,
  monthYear,
  type CioEntity,
  type CioVintage,
  type CompositeKey,
} from '../fixtures/cioMonthly';
import type { EntityId } from '../fixtures/published';
import {
  CATEGORY_KEYS,
  cioHistory,
  formatTargets,
  MIN_CORRELATION_MONTHS,
  parseTargets,
} from '../lib/cioHistory';
import { bandsFor, parseSeriesKey } from '../lib/crossFilter';
import { useUrlParam } from '../lib/urlState';

/** CIO Monthly › Explore: the published reports as one history to work through. The report
 *  slider above is the timeline — every panel marks the report on screen — and a category chosen
 *  in the grid is followed in the panel beside it, and on the Performance and Positioning tabs
 *  (lib/crossFilter.ts). Selections live in the address (`cat`, `pair`, `targets`), so a view can
 *  be shared as a link. */
export function CioExplore({
  entity,
  vintage,
  e,
  source,
  onSelectReport,
}: {
  entity: EntityId;
  /** the report on screen */
  vintage: CioVintage;
  /** its figures for this fund */
  e: CioEntity;
  /** what is on screen when it is not a published report */
  source: 'published' | 'template file' | 'workstation dataset';
  onSelectReport: (dataThrough: string) => void;
}) {
  const history = useMemo(() => cioHistory(CIO_VINTAGES, (v) => cioFor(entity, v)), [entity]);
  // every figure in the grid and the month table opens its own report's record
  const fund = entity === 'OPEB' ? 'opeb' : 'pension';
  const bands = useMemo(() => bandsFor(entity), [entity]);
  const published = source === 'published';
  const current = published ? history.months.indexOf(vintage.dataThrough) : -1;

  const [catRaw, setCat] = useUrlParam('cat', 'total');
  const cat = parseSeriesKey(catRaw);
  const [pairRaw, setPairRaw] = useUrlParam('pair', 'growth-credit');
  const pair: Pair = parsePair(pairRaw) ?? ['growth', 'credit'];
  const [targetsRaw, setTargetsRaw] = useUrlParam('targets', '');
  const printed = Object.fromEntries(
    CATEGORY_KEYS.map((k) => [k, String(e.comps.find((c) => c.k === k)?.tgt ?? '')]),
  ) as Record<CompositeKey, string>;
  const entries = { ...printed, ...parseTargets(targetsRaw) };
  const setEntry = (k: CompositeKey, v: string) => {
    const next = { ...entries, [k]: v };
    const same = CATEGORY_KEYS.every((x) => next[x] === printed[x]);
    setTargetsRaw(same ? '' : formatTargets(next));
  };

  const gapMonths = history.months.filter((_, i) => history.reports[i] === null);
  const first = CIO_VINTAGES[0]!;
  const last = CIO_VINTAGES[CIO_VINTAGES.length - 1]!;
  const catLabel = history.labels[cat];

  return (
    <>
      {published ? null : (
        <p className="footnote x-note">
          The month grid, the category panel and the correlations use the {CIO_VINTAGES.length}{' '}
          published reports; the {source} on screen is not part of that history. The scenario at the
          bottom uses its figures.
        </p>
      )}
      <Panel
        id="cio-x-grid"
        kicker={`${CIO_VINTAGES.length} published reports`}
        title="Which categories moved the fund, month by month?"
        method={
          <p>
            Each column is one report&apos;s one-month net return, as that report first printed it
            (percent, one decimal); a later report&apos;s restatement of an earlier month is not
            applied.{' '}
            {gapMonths.length
              ? `No report carries ${gapMonths.map(monthYear).join(', ')} data, so that column is empty rather than filled in. `
              : ''}
            Shading marks the size of a month (blue up, grey down); the number is always printed.
          </p>
        }
      >
        <ReturnGrid
          fund={fund}
          history={history}
          current={current}
          cat={cat}
          onSelectCat={setCat}
          onSelectMonth={onSelectReport}
        />
        <SourceLine>
          {CIO_VINTAGES.length} CIO Monthly Reports, {first.reportLabel} through {last.reportLabel}{' '}
          — each report&apos;s one-month returns, benchmarks and positioning, as printed
        </SourceLine>
      </Panel>

      <div className="grid-panels mt">
        <Panel
          id="cio-x-cat"
          kicker="Chosen in the grid"
          title={`${catLabel}: ${cat === 'total' ? 'return and market value' : 'return and weight'}`}
          method={
            <>
              <p>
                Return and benchmark are the one-month figures each report printed; excess is
                calculated (return − benchmark, percentage points). Private-market benchmarks are
                lagged one to three months (IPS Table 2), as in the reports.
              </p>
              <p>
                {cat === 'total'
                  ? 'Market value is the fund total each report printed. It changes with contributions, benefit payments and fees as well as with returns, so it is not a return.'
                  : 'Weight is the month-end share of the fund each report printed, against the target the report printed. The policy range is IPS Table 1 (restated June 12, 2024).'}
              </p>
            </>
          }
        >
          <CategoryTrend
            fund={fund}
            history={history}
            cat={cat}
            current={current}
            band={cat === 'total' ? null : (bands[cat] ?? null)}
            onSelectMonth={onSelectReport}
          />
        </Panel>

        <Panel
          id="cio-x-corr"
          kicker={
            <>
              Monthly returns <ClassBadge c="calculated" />
            </>
          }
          title="Have the categories moved together?"
          method={
            <>
              <p>
                Pearson correlation of two categories&apos; one-month returns over the months where
                both have a figure — a missing month is left out, never counted as zero — shown from{' '}
                {MIN_CORRELATION_MONTHS} months. The Total Fund is left out: it contains each
                category, so its correlation with them is partly built in.
              </p>
              <p>
                The range is the approximate 95% interval (Fisher z), which assumes independent
                months. Private equity, real estate and other private holdings are valued by
                appraisal, with a lag, which smooths their monthly returns: correlations with them
                read lower than the economic relation, and the true range is wider than the one
                given. {history.reports.filter(Boolean).length} months is a short history; this
                describes those months and forecasts nothing.
              </p>
            </>
          }
        >
          <CorrelationMap
            history={history}
            pair={pair}
            current={current}
            onSelectPair={([a, b]) => setPairRaw(`${a}-${b}`)}
          />
        </Panel>
      </div>

      <Panel
        id="cio-x-scenario"
        className="mt"
        kicker={
          <>
            Hypothetical — arithmetic, not a recommendation <ClassBadge c="calculated" />
          </>
        }
        title="What would it take to move to different targets?"
        method={
          <>
            <p>
              For each category: proposed target × the lines&apos; total market value − the
              category&apos;s market value, from the {monthYear(vintage.dataThrough)}{' '}
              {published ? 'report' : source}. The other line (cash and overlays) holds no policy
              weight, so it is a source of funds; the base is the lines added up, so buys equal
              sells exactly (the fund total printed in the report can differ by rounding).
            </p>
            <p>
              This is not a trade plan. Private equity, real estate, infrastructure and private
              credit cannot be bought or sold in these amounts quickly, the figures are month-end
              values, and a target outside the IPS Table 1 range would need a change to the
              Investment Policy Statement.
            </p>
          </>
        }
      >
        <RebalanceScenario
          e={e}
          monthLabel={monthYear(vintage.dataThrough)}
          bands={bands}
          entries={entries}
          onChange={setEntry}
          onReset={() => setTargetsRaw('')}
        />
      </Panel>
    </>
  );
}
