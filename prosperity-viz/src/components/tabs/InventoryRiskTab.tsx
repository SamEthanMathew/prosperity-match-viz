import { useMemo } from 'react';
import { PlotlyWrapper } from '../shared/PlotlyWrapper';
import { useReplayStore } from '../../store/useReplayStore';
import { PRODUCT_COLORS, CAP_MAP } from '../../types/data';

const PLOT_BG = '#1e1e2e';
const PAPER_BG = '#181825';
const TEXT_COLOR = '#cdd6f4';
const GRID_COLOR = '#313244';

export function InventoryRiskTab() {
  const botStates = useReplayStore((s) => s.botStates);
  const activeTimestamp = useReplayStore((s) => s.activeTimestamp);
  const { setActiveTimestamp } = useReplayStore();
  const meta = useReplayStore((s) => s.meta);

  const products = useMemo(() => [...new Set(botStates.map((b) => b.product))], [botStates]);

  // Inventory timeline data per product
  const invTimelineData = useMemo(() => {
    const traces: object[] = [];
    for (const product of products) {
      const productStates = botStates
        .filter((b) => b.product === product)
        .sort((a, b) => a.timestamp - b.timestamp);

      const posColors = productStates.map((b) =>
        b.inv >= 0 ? 'rgba(166,227,161,0.7)' : 'rgba(243,139,168,0.7)',
      );

      traces.push({
        type: 'scatter',
        mode: 'lines',
        x: productStates.map((b) => b.timestamp),
        y: productStates.map((b) => b.inv),
        name: product,
        line: { color: PRODUCT_COLORS[product] ?? '#888', width: 1.5 },
        fill: 'tozeroy',
        fillcolor: posColors[0],
        hovertemplate: 'ts=%{x}<br>inv=%{y}<extra>' + product + '</extra>',
      });
    }
    return traces;
  }, [botStates, products]);

  // Inventory histogram data
  const histData = useMemo(() => {
    const traces: object[] = [];
    for (const product of products) {
      const invValues = botStates
        .filter((b) => b.product === product)
        .map((b) => b.inv);
      traces.push({
        type: 'histogram',
        x: invValues,
        name: product,
        marker: { color: PRODUCT_COLORS[product] ?? '#888', opacity: 0.7 },
        nbinsx: 20,
        hovertemplate: 'inv=%{x}<br>count=%{y}<extra>' + product + '</extra>',
      });
    }
    return traces;
  }, [botStates, products]);

  // Cap utilization histogram
  const capUtilData = useMemo(() => {
    const traces: object[] = [];
    for (const product of products) {
      const cap = CAP_MAP[product] ?? 30;
      const utilValues = botStates
        .filter((b) => b.product === product)
        .map((b) => Math.abs(b.inv) / cap);
      traces.push({
        type: 'histogram',
        x: utilValues,
        name: product,
        marker: { color: PRODUCT_COLORS[product] ?? '#888', opacity: 0.7 },
        nbinsx: 20,
        xbins: { start: 0, end: 1, size: 0.05 },
        hovertemplate: 'util=%{x:.0%}<br>count=%{y}<extra>' + product + '</extra>',
      });
    }
    return traces;
  }, [botStates, products]);

  const handleClick = (event: { points: Array<{ x?: unknown }> }) => {
    const pt = event.points[0];
    if (pt?.x !== undefined) setActiveTimestamp(Math.round(pt.x as number));
  };

  const invTimelineLayout = useMemo(() => ({
    xaxis: { title: 'Timestamp (ms)', color: TEXT_COLOR, gridcolor: GRID_COLOR },
    yaxis: { title: 'Inventory', color: TEXT_COLOR, gridcolor: GRID_COLOR, zeroline: true, zerolinecolor: '#45475a' },
    shapes: [
      // Cap lines for each product
      ...products.flatMap((product) => {
        const cap = CAP_MAP[product] ?? 30;
        return [
          { type: 'line', x0: 0, x1: 200000, y0: cap, y1: cap, line: { color: '#f38ba8', width: 1, dash: 'dash' } },
          { type: 'line', x0: 0, x1: 200000, y0: -cap, y1: -cap, line: { color: '#f38ba8', width: 1, dash: 'dash' } },
          { type: 'line', x0: 0, x1: 200000, y0: Math.round(cap * 0.85), y1: Math.round(cap * 0.85), line: { color: '#fab387', width: 0.5, dash: 'dot' } },
          { type: 'line', x0: 0, x1: 200000, y0: -Math.round(cap * 0.85), y1: -Math.round(cap * 0.85), line: { color: '#fab387', width: 0.5, dash: 'dot' } },
        ];
      }),
      // Active ts line
      { type: 'line', x0: activeTimestamp, x1: activeTimestamp, y0: 0, y1: 1, yref: 'paper', line: { color: 'rgba(249,226,175,0.8)', width: 1.5, dash: 'dot' } },
    ],
    margin: { t: 20, r: 10, b: 40, l: 60 },
    plot_bgcolor: PLOT_BG, paper_bgcolor: PAPER_BG,
    font: { color: TEXT_COLOR, size: 11 },
    hovermode: 'x unified',
    legend: { orientation: 'h', y: -0.2 },
  }), [products, activeTimestamp]);

  const histLayout = {
    xaxis: { title: 'Inventory', color: TEXT_COLOR, gridcolor: GRID_COLOR },
    yaxis: { title: 'Ticks', color: TEXT_COLOR, gridcolor: GRID_COLOR },
    barmode: 'overlay',
    margin: { t: 20, r: 10, b: 40, l: 50 },
    plot_bgcolor: PLOT_BG, paper_bgcolor: PAPER_BG,
    font: { color: TEXT_COLOR, size: 11 },
    legend: { orientation: 'h', y: -0.2 },
  };

  const capLayout = {
    xaxis: { title: 'Cap Utilization', color: TEXT_COLOR, gridcolor: GRID_COLOR, tickformat: ',.0%' },
    yaxis: { title: 'Ticks', color: TEXT_COLOR, gridcolor: GRID_COLOR },
    barmode: 'overlay',
    margin: { t: 20, r: 10, b: 40, l: 50 },
    plot_bgcolor: PLOT_BG, paper_bgcolor: PAPER_BG,
    font: { color: TEXT_COLOR, size: 11 },
    shapes: [
      { type: 'line', x0: 0.85, x1: 0.85, y0: 0, y1: 1, yref: 'paper', line: { color: '#f38ba8', width: 1.5, dash: 'dash' } },
    ],
    legend: { orientation: 'h', y: -0.2 },
  };

  // Final positions
  const finalPositions = meta?.positions.filter((p) => p.symbol !== 'XIRECS') ?? [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'auto', padding: 8, gap: 8 }}>
      <div style={{ color: '#89b4fa', fontSize: 13, fontWeight: 'bold' }}>Inventory Risk Dashboard</div>

      {/* Final positions */}
      <div style={{ display: 'flex', gap: 8 }}>
        {finalPositions.map((pos) => (
          <div key={pos.symbol} style={{ background: '#181825', border: '1px solid #313244', borderRadius: 6, padding: '6px 12px' }}>
            <div style={{ color: PRODUCT_COLORS[pos.symbol] ?? '#cdd6f4', fontSize: 12, fontWeight: 'bold' }}>
              {pos.symbol}
            </div>
            <div style={{ color: pos.quantity >= 0 ? '#a6e3a1' : '#f38ba8', fontFamily: 'monospace', fontSize: 13 }}>
              {pos.quantity >= 0 ? '+' : ''}{pos.quantity}
            </div>
            <div style={{ color: '#6c7086', fontSize: 10 }}>
              final position ({(Math.abs(pos.quantity) / (CAP_MAP[pos.symbol] ?? 30) * 100).toFixed(0)}% of cap)
            </div>
          </div>
        ))}
      </div>

      {/* Inventory timeline */}
      <div style={{ background: '#181825', border: '1px solid #313244', borderRadius: 6, overflow: 'hidden', height: 250 }}>
        <div style={{ color: '#7f849c', fontSize: 10, padding: '4px 8px' }}>Inventory over time</div>
        <PlotlyWrapper
          data={invTimelineData}
          layout={invTimelineLayout}
          onClick={handleClick}
          style={{ width: '100%', height: 220 }}
        />
      </div>

      {/* Histograms row */}
      <div style={{ display: 'flex', gap: 8, flex: 1 }}>
        <div style={{ flex: 1, background: '#181825', border: '1px solid #313244', borderRadius: 6, overflow: 'hidden', minHeight: 200 }}>
          <div style={{ color: '#7f849c', fontSize: 10, padding: '4px 8px' }}>Inventory distribution</div>
          <PlotlyWrapper
            data={histData}
            layout={histLayout}
            style={{ width: '100%', height: 190 }}
          />
        </div>
        <div style={{ flex: 1, background: '#181825', border: '1px solid #313244', borderRadius: 6, overflow: 'hidden', minHeight: 200 }}>
          <div style={{ color: '#7f849c', fontSize: 10, padding: '4px 8px' }}>Cap utilization (red = near-cap zone)</div>
          <PlotlyWrapper
            data={capUtilData}
            layout={capLayout}
            style={{ width: '100%', height: 190 }}
          />
        </div>
      </div>
    </div>
  );
}
