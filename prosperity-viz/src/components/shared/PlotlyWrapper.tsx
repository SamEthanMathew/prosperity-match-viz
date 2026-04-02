import { useEffect, useRef } from 'react';
import type { MutableRefObject } from 'react';
// @ts-expect-error -- plotly.js-dist-min types are available but import style varies
import Plotly from 'plotly.js-dist-min';

// Plotly extends the HTML element with event methods
interface PlotlyHTMLElement extends HTMLDivElement {
  on(event: string, handler: (data: unknown) => void): void;
  removeAllListeners(event: string): void;
}

export interface PlotlyWrapperProps {
  data: object[];
  layout: object;
  config?: object;
  onRelayout?: (event: Record<string, unknown>) => void;
  onClick?: (event: { points: Array<{ x?: unknown; y?: unknown }> }) => void;
  className?: string;
  style?: React.CSSProperties;
  divRef?: MutableRefObject<HTMLDivElement | null>;
}

const DEFAULT_CONFIG = {
  displayModeBar: true,
  modeBarButtonsToRemove: ['lasso2d', 'select2d', 'toImage'],
  responsive: true,
  displaylogo: false,
  scrollZoom: true,
};

export function PlotlyWrapper({
  data,
  layout,
  config,
  onRelayout,
  onClick,
  className,
  style,
  divRef: externalRef,
}: PlotlyWrapperProps) {
  const internalRef = useRef<HTMLDivElement | null>(null);
  const divRef = externalRef ?? internalRef;
  const onRelayoutRef = useRef(onRelayout);
  const onClickRef = useRef(onClick);
  onRelayoutRef.current = onRelayout;
  onClickRef.current = onClick;

  // Initial mount
  useEffect(() => {
    const el = divRef.current as PlotlyHTMLElement | null;
    if (!el) return;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    void (Plotly as { newPlot: (...args: unknown[]) => Promise<void> }).newPlot(
      el,
      data,
      layout,
      { ...DEFAULT_CONFIG, ...config },
    );

    el.on('plotly_relayout', (event) => {
      onRelayoutRef.current?.(event as Record<string, unknown>);
    });

    el.on('plotly_click', (event) => {
      onClickRef.current?.(event as { points: Array<{ x?: unknown; y?: unknown }> });
    });

    // ResizeObserver
    const ro = new ResizeObserver(() => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      void (Plotly as { Plots: { resize: (el: HTMLElement) => void } }).Plots.resize(el);
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      (Plotly as { purge: (el: HTMLElement) => void }).purge(el);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update on data/layout changes
  useEffect(() => {
    const el = divRef.current as PlotlyHTMLElement | null;
    if (!el) return;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    void (Plotly as { react: (...args: unknown[]) => Promise<void> }).react(
      el,
      data,
      layout,
      { ...DEFAULT_CONFIG, ...config },
    );
  }, [data, layout, config, divRef]);

  return (
    <div
      ref={divRef}
      className={className}
      style={style}
    />
  );
}
