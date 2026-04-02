/** Default max points per series for chart rendering (LOD). */
export const CHART_MAX_POINTS = 4096;

/**
 * Uniform stride downsampling: keeps first/last and spreads intermediate samples.
 * O(maxPoints); stable for time-series where extreme points matter less than stride (use min/max bucket for critical extrema elsewhere).
 */
export function downsampleByStride<T>(items: readonly T[], maxPoints: number = CHART_MAX_POINTS): T[] {
  if (items.length <= maxPoints) return [...items];
  const out: T[] = [];
  const step = (items.length - 1) / (maxPoints - 1);
  for (let i = 0; i < maxPoints; i++) {
    const idx = Math.min(items.length - 1, Math.round(i * step));
    out.push(items[idx]);
  }
  return out;
}

/**
 * Per-bucket min/max X/Y downsampling (preserves spikes better than stride for PnL/price).
 */
export function downsampleXYMinMax(
  xs: readonly number[],
  ys: readonly number[],
  maxPoints: number = CHART_MAX_POINTS,
): { x: number[]; y: number[] } {
  if (xs.length !== ys.length) throw new Error('downsampleXYMinMax: length mismatch');
  if (xs.length <= maxPoints) return { x: [...xs], y: [...ys] };

  const xo: number[] = [];
  const yo: number[] = [];
  const bucketCount = Math.floor(maxPoints / 2);
  const bucketSize = xs.length / bucketCount;

  for (let b = 0; b < bucketCount; b++) {
    const start = Math.floor(b * bucketSize);
    const end = Math.min(xs.length, Math.floor((b + 1) * bucketSize));
    if (start >= end) continue;
    let minI = start;
    let maxI = start;
    for (let j = start; j < end; j++) {
      if (ys[j] < ys[minI]) minI = j;
      if (ys[j] > ys[maxI]) maxI = j;
    }
    if (minI <= maxI) {
      xo.push(xs[minI]);
      yo.push(ys[minI]);
      if (maxI !== minI) {
        xo.push(xs[maxI]);
        yo.push(ys[maxI]);
      }
    }
  }
  return { x: xo, y: yo };
}
