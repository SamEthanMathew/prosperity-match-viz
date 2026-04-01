import { useMemo } from 'react';
import { PlotlyWrapper } from '../shared/PlotlyWrapper';
import { useReplayStore } from '../../store/useReplayStore';
import { MODE_COLORS, PRODUCT_COLORS } from '../../types/data';
import type { BotMode } from '../../types/data';

const PLOT_BG = '#1e1e2e';
const PAPER_BG = '#181825';
const TEXT_COLOR = '#cdd6f4';
const GRID_COLOR = '#313244';

const MODES: BotMode[] = ['passive', 'taker_imb', 'taker_mr_buy', 'taker_mr_sell'];
const MODE_NUMS: Record<BotMode, number> = {
  passive: 0, taker_imb: 1, taker_mr_buy: 2, taker_mr_sell: 3, skip: -1,
};

export function DecisionModeTab() {
  const botStates = useReplayStore((s) => s.botStates);
  const modeSwitches = useReplayStore((s) => s.modeSwitches);
  const trades = useReplayStore((s) => s.trades);
  const activeTimestamp = useReplayStore((s) => s.activeTimestamp);
  const { setActiveTimestamp } = useReplayStore();

  const products = useMemo(() => [...new Set(botStates.map((b) => b.product))], [botStates]);

  // Mode duration stats per product
  const modeStats = useMemo(() => {
    const stats: Record<string, Record<string, number>> = {};
    for (const product of products) {
      stats[product] = {};
      for (const mode of MODES) stats[product][mode] = 0;
      for (const bs of botStates.filter((b) => b.product === product)) {
        stats[product][bs.mode] = (stats[product][bs.mode] ?? 0) + 1;
      }
    }
    return stats;
  }, [botStates, products]);

  // Mode PnL contribution: for each trade, attribute realized PnL to the mode at that time
  const modePnlStats = useMemo(() => {
    const result: Record<string, Record<string, number>> = {};
    for (const product of products) {
      result[product] = {};
      for (const mode of MODES) result[product][mode] = 0;

      // Build mode at each trade timestamp
      const productStates = botStates
        .filter((b) => b.product === product)
        .sort((a, b) => a.timestamp - b.timestamp);

      const productTrades = trades.filter((t) => t.symbol === product);

      for (const trade of productTrades) {
        // Find mode at trade time
        let mode: BotMode = 'passive';
        for (const bs of productStates) {
          if (bs.timestamp <= trade.timestamp) mode = bs.mode;
          else break;
        }
        const pnlContrib = trade.isBuy ? -trade.price * trade.quantity : trade.price * trade.quantity;
        result[product][mode] = (result[product][mode] ?? 0) + pnlContrib;
      }
    }
    return result;
  }, [botStates, trades, products]);

  // Heatmap data: x=timestamp, y=product, z=mode number
  const heatmapData = useMemo(() => {
    const traces: object[] = [];
    for (const product of products) {
      const productStates = botStates
        .filter((b) => b.product === product)
        .sort((a, b) => a.timestamp - b.timestamp);
      if (productStates.length === 0) continue;

      // Sample every 5th state
      const sampled = productStates.filter((_, i) => i % 5 === 0);
      traces.push({
        type: 'scatter',
        mode: 'markers',
        x: sampled.map((b) => b.timestamp),
        y: sampled.map(() => product),
        marker: {
          symbol: 'square',
          size: 6,
          color: sampled.map((b) => MODE_COLORS[b.mode] ?? '#585b70'),
        },
        name: product,
        showlegend: false,
        hovertemplate: 'ts=%{x}<br>mode=%{text}<extra>' + product + '</extra>',
        text: sampled.map((b) => b.mode),
      });
    }
    return traces;
  }, [botStates, products]);

  // Mode switch scatter
  const switchData = useMemo(() => {
    const traces: object[] = [];
    for (const product of products) {
      const productSwitches = modeSwitches.filter((m) => m.product === product);
      if (productSwitches.length === 0) continue;
      traces.push({
        type: 'scatter',
        mode: 'markers',
        x: productSwitches.map((m) => m.timestamp),
        y: productSwitches.map((m) => MODE_NUMS[m.toMode] ?? 0),
        name: product,
        marker: {
          symbol: 'diamond',
          size: 10,
          color: productSwitches.map((m) => MODE_COLORS[m.toMode] ?? '#585b70'),
          line: { color: PRODUCT_COLORS[product] ?? '#888', width: 1 },
        },
        text: productSwitches.map((m) => `${m.fromMode}→${m.toMode}`),
        hovertemplate: '%{text}<br>ts=%{x}<extra>' + product + '</extra>',
      });
    }
    return traces;
  }, [modeSwitches, products]);

  const heatLayout = useMemo(() => ({
    xaxis: {
      title: 'Timestamp (ms)',
      color: TEXT_COLOR,
      gridcolor: GRID_COLOR,
    },
    yaxis: { color: TEXT_COLOR, gridcolor: GRID_COLOR },
    shapes: [{
      type: 'line', x0: activeTimestamp, x1: activeTimestamp,
      y0: 0, y1: 1, yref: 'paper',
      line: { color: 'rgba(249,226,175,0.8)', width: 1.5, dash: 'dot' },
    }],
    margin: { t: 20, r: 10, b: 40, l: 80 },
    plot_bgcolor: PLOT_BG, paper_bgcolor: PAPER_BG,
    font: { color: TEXT_COLOR, size: 11 },
    hovermode: 'closest',
  }), [activeTimestamp]);

  const switchLayout = useMemo(() => ({
    xaxis: { title: 'Timestamp (ms)', color: TEXT_COLOR, gridcolor: GRID_COLOR },
    yaxis: {
      title: 'Mode',
      color: TEXT_COLOR, gridcolor: GRID_COLOR,
      tickvals: [0, 1, 2, 3],
      ticktext: MODES,
    },
    shapes: [{
      type: 'line', x0: activeTimestamp, x1: activeTimestamp,
      y0: 0, y1: 1, yref: 'paper',
      line: { color: 'rgba(249,226,175,0.8)', width: 1.5, dash: 'dot' },
    }],
    margin: { t: 20, r: 10, b: 40, l: 100 },
    plot_bgcolor: PLOT_BG, paper_bgcolor: PAPER_BG,
    font: { color: TEXT_COLOR, size: 11 },
    hovermode: 'closest',
  }), [activeTimestamp]);

  const handleSwitchClick = (event: { points: Array<{ x?: unknown }> }) => {
    const pt = event.points[0];
    if (pt?.x !== undefined) setActiveTimestamp(Math.round(pt.x as number));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'auto', padding: 8, gap: 8 }}>
      <div style={{ color: '#89b4fa', fontSize: 13, fontWeight: 'bold' }}>Decision Mode Dashboard</div>

      {/* Stats grid */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {products.map((product) => (
          <div key={product} style={{ background: '#181825', border: '1px solid #313244', borderRadius: 6, padding: '8px 12px', minWidth: 220 }}>
            <div style={{ color: PRODUCT_COLORS[product] ?? '#cdd6f4', fontWeight: 'bold', fontSize: 12, marginBottom: 6 }}>
              {product}
            </div>
            {MODES.map((mode) => {
              const ticks = modeStats[product]?.[mode] ?? 0;
              const pnl = modePnlStats[product]?.[mode] ?? 0;
              if (ticks === 0) return null;
              return (
                <div key={mode} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', fontSize: 11 }}>
                  <span style={{ color: MODE_COLORS[mode], marginRight: 8 }}>{mode}</span>
                  <span style={{ color: '#7f849c' }}>{ticks} ticks</span>
                  <span style={{ color: pnl >= 0 ? '#a6e3a1' : '#f38ba8', fontFamily: 'monospace', marginLeft: 8 }}>
                    {pnl >= 0 ? '+' : ''}{pnl.toFixed(0)}
                  </span>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Mode heatmap */}
      <div style={{ background: '#181825', border: '1px solid #313244', borderRadius: 6, overflow: 'hidden', height: 120 }}>
        <div style={{ color: '#7f849c', fontSize: 10, padding: '4px 8px' }}>Mode over time</div>
        <PlotlyWrapper
          data={heatmapData}
          layout={heatLayout}
          onClick={handleSwitchClick}
          style={{ width: '100%', height: 90 }}
        />
      </div>

      {/* Mode switch scatter */}
      <div style={{ background: '#181825', border: '1px solid #313244', borderRadius: 6, overflow: 'hidden', height: 220 }}>
        <div style={{ color: '#7f849c', fontSize: 10, padding: '4px 8px' }}>Mode transitions ({modeSwitches.length} total)</div>
        <PlotlyWrapper
          data={switchData}
          layout={switchLayout}
          onClick={handleSwitchClick}
          style={{ width: '100%', height: 190 }}
        />
      </div>
    </div>
  );
}
