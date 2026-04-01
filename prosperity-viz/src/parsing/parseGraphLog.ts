import type { EquityPoint } from '../types/data';

/** Parse graphLog CSV string: "timestamp;value" */
export function parseGraphLog(raw: string): EquityPoint[] {
  const lines = raw.split('\n');
  const points: EquityPoint[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const parts = line.split(';');
    if (parts.length < 2) continue;
    const ts = parseInt(parts[0].trim(), 10);
    const val = parseFloat(parts[1].trim());
    if (!isNaN(ts) && !isNaN(val)) {
      points.push({ timestamp: ts, value: val });
    }
  }

  return points;
}
