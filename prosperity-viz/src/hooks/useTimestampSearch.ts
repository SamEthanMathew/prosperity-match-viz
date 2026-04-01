import { useMemo } from 'react';
import { useReplayStore } from '../store/useReplayStore';
import { bisectRight } from '../utils/arrayUtils';

/** Returns the nearest BookRow for a given timestamp and product */
export function useBookAtTimestamp(timestamp: number, product: string) {
  const masterFrames = useReplayStore((s) => s.masterFrames);

  return useMemo(() => {
    const productFrames = masterFrames
      .filter((f) => f.product === product)
      .sort((a, b) => a.timestamp - b.timestamp);

    const idx = bisectRight(productFrames, timestamp, (f) => f.timestamp);
    if (idx < 0) return productFrames[0] ?? null;
    return productFrames[Math.min(idx, productFrames.length - 1)] ?? null;
  }, [masterFrames, timestamp, product]);
}

/** Returns nearest equity point for a given timestamp */
export function useEquityAtTimestamp(timestamp: number) {
  const equityPoints = useReplayStore((s) => s.equityPoints);

  return useMemo(() => {
    if (equityPoints.length === 0) return null;
    const idx = bisectRight(equityPoints, timestamp, (p) => p.timestamp);
    if (idx < 0) return equityPoints[0];
    return equityPoints[Math.min(idx, equityPoints.length - 1)];
  }, [equityPoints, timestamp]);
}
