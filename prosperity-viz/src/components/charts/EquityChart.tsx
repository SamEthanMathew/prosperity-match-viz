import { useMemo } from 'react';
import { PlotlyWrapper } from '../shared/PlotlyWrapper';
import { usePlotlySync } from '../../hooks/usePlotlySync';
import { useReplayStore } from '../../store/useReplayStore';
import { bisectRight } from '../../utils/arrayUtils';
import { MODE_COLORS, PRODUCT_COLORS } from '../../types/data';

const PLOT_BG = '#1e1e2e';
const PAPER_BG = '#181825';
const GRID_COLOR = '#313244';
const TEXT_COLOR = '#cdd6f4';

export function EquityChart() {
  const equityPoints = useReplayStore((s) => s.equityPoints);
  const productPnl = useReplayStore((s) => s.productPnl);
  const trades = useReplayStore((s) => s.trades);
  const modeSwitches = useReplayStore((s) => s.modeSwitches);
  const bookmarks = useReplayStore((s) => s.bookmarks);
  const activeTimestamp = useReplayStore((s) => s.activeTimestamp);
  const { onRelayout, onClick, plotlyRange } = usePlotlySync();
  const chartScale = useReplayStore((s) => s.chartScales['equity']);

  // Equity PnL at a given timestamp (for placing fill markers on the curve)
  const equityAtTs = useMemo(() => {
    return (ts: number): number => {
      if (equityPoints.length === 0) return 0;
      const idx = bisectRight(equityPoints, ts, (p) => p.timestamp);
      return equityPoints[Math.max(0, Math.min(idx, equityPoints.length - 1))].value;
    };
  }, [equityPoints]);

  const data = useMemo(() => {
    const traces: object[] = [];

    // Total PnL
    traces.push({
      type: 'scatter',
      mode: 'lines',
      x: equityPoints.map((p) => p.timestamp),
      y: equityPoints.map((p) => p.value),
      name: 'Total PnL',
      line: { color: '#89dceb', width: 2 },
      hovertemplate: 'ts=%{x}<br>PnL=%{y:.2f}<extra>Total</extra>',
    });

    // Per-product PnL
    for (const [product, series] of Object.entries(productPnl)) {
      traces.push({
        type: 'scatter',
        mode: 'lines',
        x: series.map((p) => p.timestamp),
        y: series.map((p) => p.pnl),
        name: `${product} Realized`,
        line: { color: PRODUCT_COLORS[product] ?? '#888', width: 1, dash: 'dot' },
        opacity: 0.8,
        hovertemplate: `ts=%{x}<br>PnL=%{y:.2f}<extra>${product}</extra>`,
      });
    }

    // Buy fill markers (submission only; tape trades excluded)
    const buyTrades = trades.filter((t) => t.submissionSide === 'buy');
    if (buyTrades.length > 0) {
      traces.push({
        type: 'scatter',
        mode: 'markers',
        x: buyTrades.map((t) => t.timestamp),
        y: buyTrades.map((t) => equityAtTs(t.timestamp)),
        name: 'Buy',
        marker: {
          symbol: 'triangle-up',
          size: 8,
          color: PRODUCT_COLORS[buyTrades[0].symbol] ?? '#a6e3a1',
          line: { color: '#1e1e2e', width: 0.5 },
        },
        text: buyTrades.map(
          (t) => `${t.symbol} qty=${t.quantity} @${t.price}`,
        ),
        hovertemplate: '%{text}<extra>Buy</extra>',
        showlegend: false,
      });
    }

    const sellTrades = trades.filter((t) => t.submissionSide === 'sell');
    if (sellTrades.length > 0) {
      traces.push({
        type: 'scatter',
        mode: 'markers',
        x: sellTrades.map((t) => t.timestamp),
        y: sellTrades.map((t) => equityAtTs(t.timestamp)),
        name: 'Sell',
        marker: {
          symbol: 'triangle-down',
          size: 8,
          color: '#f38ba8',
          line: { color: '#1e1e2e', width: 0.5 },
        },
        text: sellTrades.map(
          (t) => `${t.symbol} qty=${t.quantity} @${t.price}`,
        ),
        hovertemplate: '%{text}<extra>Sell</extra>',
        showlegend: false,
      });
    }

    return traces;
  }, [equityPoints, productPnl, trades, equityAtTs]);

  const layout = useMemo(() => {
    // Mode switch bands
    const shapes: object[] = [];
    const yVals = equityPoints.map((p) => p.value);
    const yMin = yVals.length ? Math.min(...yVals) : -10;
    const yMax = yVals.length ? Math.max(...yVals) : 10;

    // Group consecutive mode switches into bands
    for (let i = 0; i < modeSwitches.length; i++) {
      const ms = modeSwitches[i];
      if (ms.toMode === 'passive' || ms.toMode === 'skip') continue;

      // Find end: next switch to passive/skip for same product
      let endTs = equityPoints.length ? equityPoints[equityPoints.length - 1].timestamp : ms.timestamp + 1000;
      for (let j = i + 1; j < modeSwitches.length; j++) {
        if (
          modeSwitches[j].product === ms.product &&
          (modeSwitches[j].toMode === 'passive' || modeSwitches[j].toMode === 'skip')
        ) {
          endTs = modeSwitches[j].timestamp;
          break;
        }
      }

      shapes.push({
        type: 'rect',
        x0: ms.timestamp,
        x1: endTs,
        y0: yMin,
        y1: yMax,
        fillcolor: MODE_COLORS[ms.toMode],
        opacity: 0.12,
        line: { width: 0 },
        layer: 'below',
      });
    }

    // Active timestamp line
    shapes.push({
      type: 'line',
      x0: activeTimestamp,
      x1: activeTimestamp,
      y0: 0,
      y1: 1,
      yref: 'paper',
      line: { color: 'rgba(249,226,175,0.9)', width: 1.5, dash: 'dot' },
    });

    // Bookmark annotations (only show when viewport is set and there are few)
    const annotations: object[] = [];
    if (plotlyRange) {
      const [x0, x1] = plotlyRange;
      const visibleBookmarks = bookmarks.filter(
        (b) => b.timestamp >= x0 && b.timestamp <= x1,
      );
      if (visibleBookmarks.length <= 12) {
        for (const bm of visibleBookmarks) {
          annotations.push({
            x: bm.timestamp,
            y: 1,
            yref: 'paper',
            text: bm.label.substring(0, 20),
            showarrow: false,
            font: { size: 9, color: '#fab387' },
            xanchor: 'center',
          });
        }
      }
    }

    return {
      xaxis: {
        title: 'Timestamp (ms)',
        color: TEXT_COLOR,
        gridcolor: GRID_COLOR,
        range: plotlyRange,
        type: 'linear',
      },
      yaxis: {
        title: 'PnL (cash)',
        color: TEXT_COLOR,
        gridcolor: GRID_COLOR,
        zeroline: true,
        zerolinecolor: '#45475a',
        ...(chartScale ? { scaleanchor: 'x', scaleratio: chartScale.y / chartScale.x } : {}),
      },
      hovermode: 'x unified',
      legend: { orientation: 'h', y: -0.15, font: { color: TEXT_COLOR, size: 10 } },
      margin: { t: 20, r: 10, b: 50, l: 60 },
      plot_bgcolor: PLOT_BG,
      paper_bgcolor: PAPER_BG,
      font: { color: TEXT_COLOR, size: 11 },
      shapes,
      annotations,
    };
  }, [equityPoints, modeSwitches, activeTimestamp, plotlyRange, bookmarks, chartScale]);

  return (
    <PlotlyWrapper
      data={data}
      layout={layout}
      onRelayout={onRelayout}
      onClick={onClick}
      style={{ width: '100%', height: '100%' }}
    />
  );
}
