import { useCallback } from 'react';
import { useReplayStore } from '../store/useReplayStore';

interface RelayoutEvent {
  'xaxis.range[0]'?: number;
  'xaxis.range[1]'?: number;
  'xaxis.autorange'?: boolean;
  [key: string]: unknown;
}

export function usePlotlySync() {
  const viewportRange = useReplayStore((s) => s.viewportRange);
  const setViewportRange = useReplayStore((s) => s.setViewportRange);
  const setActiveTimestamp = useReplayStore((s) => s.setActiveTimestamp);

  const onRelayout = useCallback(
    (event: RelayoutEvent) => {
      const x0 = event['xaxis.range[0]'];
      const x1 = event['xaxis.range[1]'];
      if (x0 !== undefined && x1 !== undefined) {
        setViewportRange({ xStart: x0 as number, xEnd: x1 as number });
      } else if (event['xaxis.autorange'] === true) {
        setViewportRange(null);
      }
    },
    [setViewportRange],
  );

  const onClick = useCallback(
    (event: { points: Array<{ x?: unknown }> }) => {
      const pt = event.points[0];
      if (pt?.x !== undefined) {
        const ts = Math.round(pt.x as number);
        setActiveTimestamp(ts);
      }
    },
    [setActiveTimestamp],
  );

  const plotlyRange: [number, number] | undefined = viewportRange
    ? [viewportRange.xStart, viewportRange.xEnd]
    : undefined;

  return { onRelayout, onClick, plotlyRange };
}
