/** Number formats for the Explore sub-tab: percent as printed (one decimal), money in $M, a
 *  minus sign rather than a hyphen, and a missing figure said to be missing, never shown as 0. */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const minus = (v: number) => (v < 0 ? '−' : '');

export const pct1 = (v: number | null | undefined) =>
  v === null || v === undefined ? '—' : `${minus(v)}${Math.abs(v).toFixed(1)}%`;

export const signed1 = (v: number | null | undefined) =>
  v === null || v === undefined ? '—' : `${v > 0 ? '+' : minus(v)}${Math.abs(v).toFixed(1)}`;

export const r2 = (v: number | null) => (v === null ? '—' : `${minus(v)}${Math.abs(v).toFixed(2)}`);

export const moneyM = (v: number) =>
  `${minus(v)}$${Math.round(Math.abs(v)).toLocaleString('en-US')}M`;

/** "Feb ’25" */
export const shortMonth = (iso: string) =>
  `${MONTHS[Number(iso.slice(5, 7)) - 1]} ’${iso.slice(2, 4)}`;
