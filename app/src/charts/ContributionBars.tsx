import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { catLabel, fmtPct } from '../components/ui';

/**
 * QTD contribution by category — polarity encoding (validated diverging pair),
 * horizontal bars, value labels on every bar (few marks), zero baseline rule.
 */

const POSITIVE = '#3a6ea5';
const NEGATIVE = '#b4562a';

export interface ContributionDatum {
  categoryId: string;
  value: number;
}

export function ContributionBars({ data }: { data: ContributionDatum[] }) {
  if (data.length === 0) return <p className="footnote">No contribution records.</p>;
  const rows = data.map((d) => ({ ...d, label: catLabel(d.categoryId) }));
  return (
    <figure
      style={{ margin: 0 }}
      role="img"
      aria-label={`Quarter-to-date contribution by category. ${rows
        .map((r) => `${r.label} ${fmtPct(r.value)}`)
        .join(', ')}. A data table follows this chart.`}
    >
      <ResponsiveContainer width="100%" height={40 * rows.length + 30}>
        <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 64, bottom: 4, left: 8 }}>
          <XAxis
            type="number"
            tickFormatter={(v: number) => fmtPct(v, 1)}
            tick={{ fontSize: 11, fill: '#5d6b76' }}
            axisLine={{ stroke: '#d8d2c4' }}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="label"
            width={210}
            tick={{ fontSize: 12, fill: '#22303c' }}
            axisLine={false}
            tickLine={false}
          />
          <ReferenceLine x={0} stroke="#5d6b76" />
          <Tooltip
            formatter={(v: number | string) => [
              typeof v === 'number' ? fmtPct(v) : v,
              'contribution',
            ]}
            contentStyle={{ fontSize: 12, borderColor: '#d8d2c4', background: '#fff' }}
          />
          <Bar dataKey="value" isAnimationActive={false} barSize={18} radius={[0, 4, 4, 0]}>
            {rows.map((r) => (
              <Cell key={r.categoryId} fill={r.value >= 0 ? POSITIVE : NEGATIVE} />
            ))}
            <LabelList
              dataKey="value"
              position="right"
              formatter={(v: number) => fmtPct(v)}
              style={{ fontSize: 11, fill: '#22303c', fontVariantNumeric: 'tabular-nums' }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <figcaption className="footnote">
        Beginning-weight × monthly return, summed over the quarter. Blue = positive, rust = negative
        contribution. Reconciliation shown in the table below.
      </figcaption>
    </figure>
  );
}
