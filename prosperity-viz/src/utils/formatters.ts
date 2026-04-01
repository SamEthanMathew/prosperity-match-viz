export function fmtTs(ts: number): string {
  const s = (ts / 1000).toFixed(1);
  return `${ts} (${s}s)`;
}

export function fmtNum(n: number | null | undefined, decimals = 2): string {
  if (n === null || n === undefined) return '—';
  return n.toFixed(decimals);
}

export function fmtPnl(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  const sign = n >= 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}`;
}

export function fmtPrice(n: number): string {
  return n.toFixed(2);
}
