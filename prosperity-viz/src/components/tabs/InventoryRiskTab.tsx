import { useMemo } from 'react';
import { PlotlyWrapper } from '../shared/PlotlyWrapper';
import { useReplayStore } from '../../store/useReplayStore';
import { PRODUCT_COLORS, CAP_MAP } from '../../types/data';

const PLOT_BG = '#1e1e2e';
const PAPER_BG = '#181825';
const TEXT_COLOR = '#cdd6f4';
const GRID_COLOR = '#313244';

export function InventoryRiskTab() {
  const trades = useReplayStore((s) => s.trades);
  const activeTimestamp = useReplayStore((s) => s.activeTimestamp);
  const { setActiveTimestamp } = useReplayStore();
  const meta = useReplayStore((s) => s.meta);

  // Only our fills (SUBMISSION buys/sells), not tape trades
  const myTrades = useMemo(
    () => trades.filter((t) => t.submissionSide !== null),
    [trades],
  );

  const products = useMemo(
    () => [...new Set(myTrades.map((t) => t.symbol))],
    [myTrades],
  );

  /**
   * Build exact inventory step-function from trade history.
   * Inventory starts at 0, steps up on each buy, steps down on each sell.
   * line.shape='hv' makes Plotly draw horizontal-then-vertical steps.
   */
  const invTimelineData = useMemo(() => {
    const traces: object[] = [];

    for (const product of products) {
      const productTrades = myTrades
        .filter((t) => t.symbol === product)
        .sort((a, b) => a.timestamp - b.timestamp);

      // Build step-function points
      const x: number[] = [0];
      const y: number[] = [0];
      let inv = 0;

      for (const trade of productTrades) {
        inv += trade.isBuy ? trade.quantity : -trade.quantity;
        x.push(trade.timestamp);
        y.push(inv);
      }

      // Extend to end of match
      x.push(200000);
      y.push(inv);

      // Green fill for positive (long) inventory
      traces.push({
        type: 'scatter',
        mode: 'lines',
        x,
        y: y.map((v) => Math.max(0, v)),
        name: `${product} long`,
        line: { color: 'rgba(166,227,161,0)', width: 0, shape: 'hv' },
        fill: 'tozeroy',
        fillcolor: 'rgba(166,227,161,0.2)',
        showlegend: false,
        hoverinfo: 'skip',
      });

      // Red fill for negative (short) inventory
      traces.push({
        type: 'scatter',
        mode: 'lines',
        x,
        y: y.map((v) => Math.min(0, v)),
        name: `${product} short`,
        line: { color: 'rgba(243,139,168,0)', width: 0, shape: 'hv' },
        fill: 'tozeroy',
        fillcolor: 'rgba(243,139,168,0.2)',
        showlegend: false,
        hoverinfo: 'skip',
      });

      // Main step line + hover
      traces.push({
        type: 'scatter',
        mode: 'lines',
        x,
        y,
        name: product,
        line: { color: PRODUCT_COLORS[product] ?? '#cdd6f4', width: 2, shape: 'hv' },
        fill: 'none',
        hovertemplate: 'ts=%{x}<br>inv=%{y}<extra>' + product + '</extra>',
      });
    }

    return traces;
  }, [myTrades, products]);

  /**
   * Distribution histogram — how many ticks was inventory at each level.
   * Reconstructed from trades: for each of the 2000 tick timestamps we find
   * the running inventory at that point from the trade step function.
   */
  const histData = useMemo(() => {
    const traces: object[] = [];

    for (const product of products) {
      const productTrades = myTrades
        .filter((t) => t.symbol === product)
        .sort((a, b) => a.timestamp - b.timestamp);

      // Pre-build cumulative inventory at each trade
      const tradeTimes: number[] = [0];
      const tradeInv: number[] = [0];
      let inv = 0;
      for (const trade of productTrades) {
        inv += trade.isBuy ? trade.quantity : -trade.quantity;
        tradeTimes.push(trade.timestamp);
        tradeInv.push(inv);
      }

      // Sample at every 100ms tick (0, 100, 200, … 199900)
      const invValues: number[] = [];
      for (let ts = 0; ts <= 199900; ts += 100) {
        // Binary search for last trade ≤ ts
        let lo = 0, hi = tradeTimes.length - 1;
        while (lo < hi) {
          const mid = (lo + hi + 1) >> 1;
          if (tradeTimes[mid] <= ts) lo = mid; else hi = mid - 1;
        }
        invValues.push(tradeInv[lo]);
      }

      traces.push({
        type: 'histogram',
        x: invValues,
        name: product,
        marker: { color: PRODUCT_COLORS[product] ?? '#888', opacity: 0.7 },
        nbinsx: 20,
        hovertemplate: 'inv=%{x}<br>ticks=%{y}<extra>' + product + '</extra>',
      });
    }

    return traces;
  }, [myTrades, products]);

  /**
   * Cap utilization histogram — same reconstruction, expressed as |inv|/cap.
   */
  const capUtilData = useMemo(() => {
    const traces: object[] = [];

    for (const product of products) {
      const cap = CAP_MAP[product] ?? 30;
      const productTrades = myTrades
        .filter((t) => t.symbol === product)
        .sort((a, b) => a.timestamp - b.timestamp);

      const tradeTimes: number[] = [0];
      const tradeInv: number[] = [0];
      let inv = 0;
      for (const trade of productTrades) {
        inv += trade.isBuy ? trade.quantity : -trade.quantity;
        tradeTimes.push(trade.timestamp);
        tradeInv.push(inv);
      }

      const utilValues: number[] = [];
      for (let ts = 0; ts <= 199900; ts += 100) {
        let lo = 0, hi = tradeTimes.length - 1;
        while (lo < hi) {
          const mid = (lo + hi + 1) >> 1;
          if (tradeTimes[mid] <= ts) lo = mid; else hi = mid - 1;
        }
        utilValues.push(Math.abs(tradeInv[lo]) / cap);
      }

      traces.push({
        type: 'histogram',
        x: utilValues,
        name: product,
        marker: { color: PRODUCT_COLORS[product] ?? '#888', opacity: 0.7 },
        nbinsx: 20,
        xbins: { start: 0, end: 1, size: 0.05 },
        hovertemplate: 'util=%{x:.0%}<br>ticks=%{y}<extra>' + product + '</extra>',
      });
    }

    return traces;
  }, [myTrades, products]);

  const handleClick = (event: { points: Array<{ x?: unknown }> }) => {
    const pt = event.points[0];
    if (pt?.x !== undefined) setActiveTimestamp(Math.round(pt.x as number));
  };

  const invTimelineLayout = useMemo(() => ({
    xaxis: { title: 'Timestamp (ms)', color: TEXT_COLOR, gridcolor: GRID_COLOR },
    yaxis: {
      title: 'Units held',
      color: TEXT_COLOR,
      gridcolor: GRID_COLOR,
      zeroline: true,
      zerolinecolor: '#45475a',
    },
    shapes: [
      ...products.flatMap((product) => {
        const cap = CAP_MAP[product] ?? 30;
        return [
          { type: 'line', x0: 0, x1: 200000, y0: cap, y1: cap, line: { color: '#f38ba8', width: 1, dash: 'dash' } },
          { type: 'line', x0: 0, x1: 200000, y0: -cap, y1: -cap, line: { color: '#f38ba8', width: 1, dash: 'dash' } },
          { type: 'line', x0: 0, x1: 200000, y0: Math.round(cap * 0.85), y1: Math.round(cap * 0.85), line: { color: '#fab387', width: 0.5, dash: 'dot' } },
          { type: 'line', x0: 0, x1: 200000, y0: -Math.round(cap * 0.85), y1: -Math.round(cap * 0.85), line: { color: '#fab387', width: 0.5, dash: 'dot' } },
        ];
      }),
      { type: 'line', x0: activeTimestamp, x1: activeTimestamp, y0: 0, y1: 1, yref: 'paper', line: { color: 'rgba(249,226,175,0.8)', width: 1.5, dash: 'dot' } },
    ],
    margin: { t: 20, r: 10, b: 40, l: 60 },
    plot_bgcolor: PLOT_BG,
    paper_bgcolor: PAPER_BG,
    font: { color: TEXT_COLOR, size: 11 },
    hovermode: 'x unified',
    legend: { orientation: 'h', y: -0.2 },
  }), [products, activeTimestamp]);

  const histLayout = {
    xaxis: { title: 'Inventory (units)', color: TEXT_COLOR, gridcolor: GRID_COLOR },
    yaxis: { title: 'Ticks', color: TEXT_COLOR, gridcolor: GRID_COLOR },
    barmode: 'overlay',
    margin: { t: 20, r: 10, b: 40, l: 50 },
    plot_bgcolor: PLOT_BG,
    paper_bgcolor: PAPER_BG,
    font: { color: TEXT_COLOR, size: 11 },
    legend: { orientation: 'h', y: -0.2 },
  };

  const capLayout = {
    xaxis: { title: 'Cap Utilization', color: TEXT_COLOR, gridcolor: GRID_COLOR, tickformat: ',.0%' },
    yaxis: { title: 'Ticks', color: TEXT_COLOR, gridcolor: GRID_COLOR },
    barmode: 'overlay',
    margin: { t: 20, r: 10, b: 40, l: 50 },
    plot_bgcolor: PLOT_BG,
    paper_bgcolor: PAPER_BG,
    font: { color: TEXT_COLOR, size: 11 },
    shapes: [
      { type: 'line', x0: 0.85, x1: 0.85, y0: 0, y1: 1, yref: 'paper', line: { color: '#f38ba8', width: 1.5, dash: 'dash' } },
    ],
    legend: { orientation: 'h', y: -0.2 },
  };

  const finalPositions = meta?.positions.filter((p) => p.symbol !== 'XIRECS') ?? [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'auto', padding: 8, gap: 8 }}>
      <div style={{ color: '#89b4fa', fontSize: 13, fontWeight: 'bold' }}>Inventory Risk Dashboard</div>

      {/* Final positions */}
      {finalPositions.length > 0 && (
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
      )}

      {/* Inventory timeline */}
      <div style={{ background: '#181825', border: '1px solid #313244', borderRadius: 6, overflow: 'hidden', height: 260 }}>
        <div style={{ color: '#7f849c', fontSize: 10, padding: '4px 8px' }}>
          Units held over time (exact from trade history) — green=long, red=short, dashed=cap, dotted=85%
        </div>
        <PlotlyWrapper
          data={invTimelineData}
          layout={invTimelineLayout}
          onClick={handleClick}
          style={{ width: '100%', height: 230 }}
        />
      </div>

      {/* Histograms row */}
      <div style={{ display: 'flex', gap: 8, flex: 1 }}>
        <div style={{ flex: 1, background: '#181825', border: '1px solid #313244', borderRadius: 6, overflow: 'hidden', minHeight: 200 }}>
          <div style={{ color: '#7f849c', fontSize: 10, padding: '4px 8px' }}>How often was each inventory level held? (2000 ticks)</div>
          <PlotlyWrapper
            data={histData}
            layout={histLayout}
            style={{ width: '100%', height: 190 }}
          />
        </div>
        <div style={{ flex: 1, background: '#181825', border: '1px solid #313244', borderRadius: 6, overflow: 'hidden', minHeight: 200 }}>
          <div style={{ color: '#7f849c', fontSize: 10, padding: '4px 8px' }}>Cap utilization over time — red line = 85% danger zone</div>
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
