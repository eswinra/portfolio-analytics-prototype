import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

/**
 * Cumulative growth of $1 — portfolio vs synthetic benchmark. One axis; thin lines;
 * benchmark dashed (secondary encoding beyond color); direct labels at line ends.
 * Palette validated with the dataviz six-check validator (see docs/architecture.md).
 */

const PORT = '#3a6ea5';
const BENCH = '#c78f2e';

export interface GrowthDatum {
  monthEnd: string;
  portfolio: number | null;
  benchmark: number | null;
}

function monthLabel(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

export function GrowthChart({ data }: { data: GrowthDatum[] }) {
  if (data.length === 0) {
    return <p className="footnote">No monthly series available to chart.</p>;
  }
  const last = data[data.length - 1];
  return (
    <figure
      style={{ margin: 0 }}
      role="img"
      aria-label={`Cumulative growth of one dollar over ${data.length} months. Portfolio ends at ${last?.portfolio?.toFixed(3) ?? 'n/a'}, benchmark at ${last?.benchmark?.toFixed(3) ?? 'n/a'}. A data table follows this chart.`}
    >
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data} margin={{ top: 8, right: 84, bottom: 4, left: 4 }}>
          <CartesianGrid stroke="#eceae3" vertical={false} />
          <XAxis
            dataKey="monthEnd"
            tickFormatter={monthLabel}
            tick={{ fontSize: 11, fill: '#5d6b76' }}
            tickLine={false}
            axisLine={{ stroke: '#d8d2c4' }}
            interval="preserveStartEnd"
          />
          <YAxis
            tickFormatter={(v: number) => v.toFixed(2)}
            tick={{ fontSize: 11, fill: '#5d6b76' }}
            tickLine={false}
            axisLine={false}
            width={44}
            domain={['auto', 'auto']}
          />
          <Tooltip
            formatter={(v: number | string, name: string) => [
              typeof v === 'number' ? v.toFixed(4) : v,
              name,
            ]}
            labelFormatter={(l) => `Month end ${l}`}
            contentStyle={{ fontSize: 12, borderColor: '#d8d2c4', background: '#fff' }}
          />
          <Line
            name="DEMOFUND (synthetic)"
            dataKey="portfolio"
            stroke={PORT}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
            connectNulls={false}
            label={(props) => (
              <EndLabel {...props} total={data.length} text="Portfolio" color={PORT} dy={-6} />
            )}
          />
          <Line
            name="Policy benchmark (synthetic)"
            dataKey="benchmark"
            stroke={BENCH}
            strokeWidth={2}
            strokeDasharray="6 4"
            dot={false}
            isAnimationActive={false}
            connectNulls={false}
            label={(props) => (
              <EndLabel {...props} total={data.length} text="Benchmark" color={BENCH} dy={12} />
            )}
          />
        </LineChart>
      </ResponsiveContainer>
      <figcaption className="footnote">
        Growth of $1, chain-linked monthly. Synthetic data; benchmark uses effective-dated policy
        weights. Solid = portfolio, dashed = benchmark.
      </figcaption>
    </figure>
  );
}

interface EndLabelProps {
  x?: number;
  y?: number;
  index?: number;
  total: number;
  text: string;
  color: string;
  dy: number;
}

function EndLabel({ x, y, index, total, text, color, dy }: EndLabelProps) {
  if (index !== total - 1 || x === undefined || y === undefined) return null;
  return (
    <text x={x + 6} y={y + dy} fill={color} fontSize={12} fontWeight={600}>
      {text}
    </text>
  );
}
