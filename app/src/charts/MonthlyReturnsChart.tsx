import {
  Bar,
  BarChart,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { fmtPct } from '../components/ui';

/**
 * Monthly net returns — polarity encoding with the validated diverging pair (blue positive,
 * rust negative), single series (no legend needed), zero baseline rule. The full monthly data
 * table lives on Performance.
 */

const POSITIVE = '#3a6ea5';
const NEGATIVE = '#b4562a';

export interface MonthlyReturnDatum {
  monthEnd: string;
  value: number | null;
}

function monthLabel(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short',
    year: '2-digit',
  });
}

export function MonthlyReturnsChart({ data }: { data: MonthlyReturnDatum[] }) {
  const rows = data.filter((d) => d.value !== null);
  if (rows.length === 0) return <p className="footnote">No monthly series available.</p>;
  const best = rows.reduce((a, b) => (b.value! > a.value! ? b : a));
  const worst = rows.reduce((a, b) => (b.value! < a.value! ? b : a));
  return (
    <figure
      style={{ margin: 0 }}
      role="img"
      aria-label={`Monthly net returns over ${rows.length} months. Best month ${monthLabel(best.monthEnd)} at ${fmtPct(best.value)}, worst ${monthLabel(worst.monthEnd)} at ${fmtPct(worst.value)}. The monthly data table is on the Performance page.`}
    >
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={rows} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
          <XAxis
            dataKey="monthEnd"
            tickFormatter={monthLabel}
            tick={{ fontSize: 11, fill: '#5d6b76' }}
            tickLine={false}
            axisLine={{ stroke: '#d8d2c4' }}
            interval="preserveStartEnd"
          />
          <YAxis
            tickFormatter={(v: number) => fmtPct(v, 0)}
            tick={{ fontSize: 11, fill: '#5d6b76' }}
            tickLine={false}
            axisLine={false}
            width={44}
          />
          <ReferenceLine y={0} stroke="#5d6b76" />
          <Tooltip
            formatter={(v: number | string) => [
              typeof v === 'number' ? fmtPct(v) : v,
              'monthly return',
            ]}
            labelFormatter={(l) => `Month end ${l}`}
            contentStyle={{ fontSize: 12, borderColor: '#d8d2c4', background: '#fff' }}
          />
          <Bar dataKey="value" isAnimationActive={false} barSize={16} radius={[4, 4, 0, 0]}>
            {rows.map((r) => (
              <Cell key={r.monthEnd} fill={(r.value ?? 0) >= 0 ? POSITIVE : NEGATIVE} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <figcaption className="footnote">
        Monthly net returns (synthetic). Blue = positive, rust = negative. Monthly table on the
        Performance page.
      </figcaption>
    </figure>
  );
}
