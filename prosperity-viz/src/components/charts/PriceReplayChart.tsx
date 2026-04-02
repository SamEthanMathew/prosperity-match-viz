import { useMemo } from 'react';
import { PlotlyWrapper } from '../shared/PlotlyWrapper';
import { usePlotlySync } from '../../hooks/usePlotlySync';
import { useReplayStore } from '../../store/useReplayStore';
import { MODE_COLORS, CAP_MAP } from '../../types/data';

const PLOT_BG = '#1e1e2e';
const PAPER_BG = '#181825';
const GRID_COLOR = '#313244';
const TEXT_COLOR = '#cdd6f4';

export function PriceReplayChart() {
  const bookRows = useReplayStore((s) => s.bookRows);
  const botStates = useReplayStore((s) => s.botStates);
  const trades = useReplayStore((s) => s.trades);
  const modeSwitches = useReplayStore((s) => s.modeSwitches);
  const activeTimestamp = useReplayStore((s) => s.activeTimestamp);
  const activeProduct = useReplayStore((s) => s.activeProduct);
  const setActiveProduct = useReplayStore((s) => s.setActiveProduct);
  const { onRelayout, onClick, plotlyRange } = usePlotlySync();
  const chartScale = useReplayStore((s) => s.chartScales['price_replay']);

  const productRows = useMemo(
    () => bookRows.filter((r) => r.product === activeProduct).sort((a, b) => a.timestamp - b.timestamp),
    [bookRows, activeProduct],
  );

  const productBotStates = useMemo(
    () => botStates.filter((b) => b.product === activeProduct).sort((a, b) => a.timestamp - b.timestamp),
    [botStates, activeProduct],
  );

  const productTrades = useMemo(
    () => trades.filter((t) => t.symbol === activeProduct).sort((a, b) => a.timestamp - b.timestamp),
    [trades, activeProduct],
  );

  const products = useMemo(() => [...new Set(bookRows.map((r) => r.product))], [bookRows]);
  const cap = CAP_MAP[activeProduct] ?? 30;

  const data = useMemo(() => {
    const traces: object[] = [];

    // Mid price
    traces.push({
      type: 'scatter',
      mode: 'lines',
      x: productRows.map((r) => r.timestamp),
      y: productRows.map((r) => r.midPrice),
      name: 'Mid',
      line: { color: '#cdd6f4', width: 1.5 },
      yaxis: 'y',
      hovertemplate: 'ts=%{x}<br>mid=%{y:.2f}<extra>Mid</extra>',
    });

    // Fair value
    if (productBotStates.length > 0) {
      traces.push({
        type: 'scatter',
        mode: 'lines',
        x: productBotStates.map((b) => b.timestamp),
        y: productBotStates.map((b) => b.fair),
        name: 'Fair',
        line: { color: '#f9e2af', width: 1, dash: 'dash' },
        yaxis: 'y',
        hovertemplate: 'ts=%{x}<br>fair=%{y:.2f}<extra>Fair</extra>',
      });
    }

    // EWMA (TOMATOES only)
    const ewmaStates = productBotStates.filter((b) => b.ewma !== undefined);
    if (ewmaStates.length > 0) {
      traces.push({
        type: 'scatter',
        mode: 'lines',
        x: ewmaStates.map((b) => b.timestamp),
        y: ewmaStates.map((b) => b.ewma),
        name: 'EWMA',
        line: { color: '#cba6f7', width: 1, dash: 'dot' },
        yaxis: 'y',
        hovertemplate: 'ts=%{x}<br>ewma=%{y:.2f}<extra>EWMA</extra>',
      });
    }

    // Best bid
    traces.push({
      type: 'scatter',
      mode: 'lines',
      x: productRows.map((r) => r.timestamp),
      y: productRows.map((r) => r.bidPrice1),
      name: 'Bid L1',
      line: { color: '#a6e3a1', width: 0.8 },
      yaxis: 'y',
      opacity: 0.7,
      hoverinfo: 'skip',
      showlegend: true,
    });

    // Best ask
    traces.push({
      type: 'scatter',
      mode: 'lines',
      x: productRows.map((r) => r.timestamp),
      y: productRows.map((r) => r.askPrice1),
      name: 'Ask L1',
      line: { color: '#f38ba8', width: 0.8 },
      yaxis: 'y',
      opacity: 0.7,
      hoverinfo: 'skip',
      showlegend: true,
    });

    // Buy fills
    const buyTrades = productTrades.filter((t) => t.isBuy);
    if (buyTrades.length > 0) {
      traces.push({
        type: 'scatter',
        mode: 'markers',
        x: buyTrades.map((t) => t.timestamp),
        y: buyTrades.map((t) => t.price),
        name: 'Buy',
        marker: {
          symbol: 'triangle-up',
          size: 10,
          color: '#a6e3a1',
          line: { color: '#1e1e2e', width: 1 },
        },
        yaxis: 'y',
        text: buyTrades.map((t) => `qty=${t.quantity}`),
        hovertemplate: 'BUY qty=%{text}<br>price=%{y:.2f}<br>ts=%{x}<extra></extra>',
      });
    }

    // Sell fills
    const sellTrades = productTrades.filter((t) => !t.isBuy);
    if (sellTrades.length > 0) {
      traces.push({
        type: 'scatter',
        mode: 'markers',
        x: sellTrades.map((t) => t.timestamp),
        y: sellTrades.map((t) => t.price),
        name: 'Sell',
        marker: {
          symbol: 'triangle-down',
          size: 10,
          color: '#f38ba8',
          line: { color: '#1e1e2e', width: 1 },
        },
        yaxis: 'y',
        text: sellTrades.map((t) => `qty=${t.quantity}`),
        hovertemplate: 'SELL qty=%{text}<br>price=%{y:.2f}<br>ts=%{x}<extra></extra>',
      });
    }

    // Inventory (y2)
    if (productBotStates.length > 0) {
      const invColors = productBotStates.map((b) =>
        b.inv >= 0 ? 'rgba(166,227,161,0.6)' : 'rgba(243,139,168,0.6)',
      );
      traces.push({
        type: 'bar',
        x: productBotStates.map((b) => b.timestamp),
        y: productBotStates.map((b) => b.inv),
        name: 'Inventory',
        marker: { color: invColors },
        yaxis: 'y2',
        hovertemplate: 'inv=%{y}<br>ts=%{x}<extra>Inventory</extra>',
      });
    }

    return traces;
  }, [productRows, productBotStates, productTrades]);

  const layout = useMemo(() => {
    const shapes: object[] = [];

    // Cap boundary lines on y2
    shapes.push(
      {
        type: 'line',
        x0: 0,
        x1: 200000,
        y0: cap,
        y1: cap,
        yref: 'y2',
        line: { color: '#f38ba8', width: 1, dash: 'dash' },
      },
      {
        type: 'line',
        x0: 0,
        x1: 200000,
        y0: -cap,
        y1: -cap,
        yref: 'y2',
        line: { color: '#f38ba8', width: 1, dash: 'dash' },
      },
      {
        type: 'line',
        x0: 0,
        x1: 200000,
        y0: Math.round(cap * 0.85),
        y1: Math.round(cap * 0.85),
        yref: 'y2',
        line: { color: '#fab387', width: 0.5, dash: 'dot' },
      },
      {
        type: 'line',
        x0: 0,
        x1: 200000,
        y0: -Math.round(cap * 0.85),
        y1: -Math.round(cap * 0.85),
        yref: 'y2',
        line: { color: '#fab387', width: 0.5, dash: 'dot' },
      },
    );

    // Mode switch bands
    const productModeSwitches = modeSwitches.filter((m) => m.product === activeProduct);
    for (let i = 0; i < productModeSwitches.length; i++) {
      const ms = productModeSwitches[i];
      if (ms.toMode === 'passive' || ms.toMode === 'skip') continue;
      let endTs = 200000;
      for (let j = i + 1; j < productModeSwitches.length; j++) {
        if (productModeSwitches[j].toMode === 'passive' || productModeSwitches[j].toMode === 'skip') {
          endTs = productModeSwitches[j].timestamp;
          break;
        }
      }
      shapes.push({
        type: 'rect',
        x0: ms.timestamp,
        x1: endTs,
        y0: 0,
        y1: 1,
        yref: 'paper',
        fillcolor: MODE_COLORS[ms.toMode],
        opacity: 0.1,
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

    return {
      xaxis: {
        title: 'Timestamp (ms)',
        color: TEXT_COLOR,
        gridcolor: GRID_COLOR,
        range: plotlyRange,
        type: 'linear',
      },
      yaxis: {
        domain: [0.3, 1.0],
        title: 'Price',
        color: TEXT_COLOR,
        gridcolor: GRID_COLOR,
        ...(chartScale ? { scaleanchor: 'x', scaleratio: chartScale.y / chartScale.x } : {}),
      },
      yaxis2: {
        domain: [0.0, 0.27],
        title: 'Inventory',
        color: TEXT_COLOR,
        gridcolor: GRID_COLOR,
        zeroline: true,
        zerolinecolor: '#45475a',
        range: [-(cap + 5), cap + 5],
      },
      hovermode: 'x unified',
      legend: { orientation: 'h', y: -0.15, font: { color: TEXT_COLOR, size: 10 } },
      margin: { t: 20, r: 10, b: 50, l: 60 },
      plot_bgcolor: PLOT_BG,
      paper_bgcolor: PAPER_BG,
      font: { color: TEXT_COLOR, size: 11 },
      barmode: 'overlay',
      shapes,
    };
  }, [modeSwitches, activeProduct, activeTimestamp, plotlyRange, cap, chartScale]);

  return (
    <div className="flex flex-col h-full">
      {/* Product selector */}
      <div className="flex gap-1 px-2 pt-1 pb-0">
        {products.map((p) => (
          <button
            key={p}
            onClick={() => setActiveProduct(p)}
            className={`px-2 py-0.5 text-xs rounded border transition-colors ${
              activeProduct === p
                ? 'bg-surface0 border-blue text-text'
                : 'border-surface0 text-subtext hover:border-overlay0'
            }`}
            style={{
              backgroundColor: activeProduct === p ? '#313244' : 'transparent',
              borderColor: activeProduct === p ? '#89b4fa' : '#313244',
              color: activeProduct === p ? '#cdd6f4' : '#a6adc8',
            }}
          >
            {p}
          </button>
        ))}
      </div>
      <div className="flex-1 min-h-0">
        <PlotlyWrapper
          data={data}
          layout={layout}
          onRelayout={onRelayout}
          onClick={onClick}
          style={{ width: '100%', height: '100%' }}
        />
      </div>
    </div>
  );
}
