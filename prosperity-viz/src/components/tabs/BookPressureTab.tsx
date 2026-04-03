import { useMemo } from 'react';
import { PlotlyWrapper } from '../shared/PlotlyWrapper';
import { useReplayStore } from '../../store/useReplayStore';
import { MODE_COLORS, PRODUCT_COLORS } from '../../types/data';
import type { BotState } from '../../types/data';

const PLOT_BG = '#1e1e2e';
const PAPER_BG = '#181825';
const TEXT_COLOR = '#cdd6f4';
const GRID_COLOR = '#313244';

const MODE_LABELS: Record<string, string> = {
  passive: 'Passive',
  taker_imb: 'Imbalance',
  taker_mr_buy: 'MR Buy',
  taker_mr_sell: 'MR Sell',
};

/** Rect shapes coloring chart background by bot mode + active timestamp cursor. */
function buildModeShapes(sortedStates: BotState[], activeTimestamp: number): object[] {
  const shapes: object[] = sortedStates.map((bs, i) => ({
    type: 'rect',
    x0: bs.timestamp,
    x1: sortedStates[i + 1]?.timestamp ?? 200000,
    y0: 0, y1: 1, yref: 'paper',
    fillcolor: MODE_COLORS[bs.mode] ?? '#313244',
    opacity: 0.1,
    line: { width: 0 },
    layer: 'below',
  }));
  shapes.push({
    type: 'line',
    x0: activeTimestamp, x1: activeTimestamp,
    y0: 0, y1: 1, yref: 'paper',
    line: { color: 'rgba(249,226,175,0.85)', width: 1.5, dash: 'dot' },
  });
  return shapes;
}

export function BookPressureTab() {
  const botStates = useReplayStore((s) => s.botStates);
  const bookRows = useReplayStore((s) => s.bookRows);
  const trades = useReplayStore((s) => s.trades);
  const activeTimestamp = useReplayStore((s) => s.activeTimestamp);
  const { setActiveTimestamp } = useReplayStore();

  const products = useMemo(
    () => [...new Set(botStates.map((b) => b.product))],
    [botStates],
  );

  const allSortedStates = useMemo(
    () => [...botStates].sort((a, b) => a.timestamp - b.timestamp),
    [botStates],
  );

  const handleClick = (event: { points: Array<{ x?: unknown }> }) => {
    const pt = event.points[0];
    if (pt?.x !== undefined) {
      const x = pt.x as number;
      if (x > 100) setActiveTimestamp(Math.round(x));
    }
  };

  // ── Chart 1: Fair Value vs Market Price ────────────────────────────────────
  const fairMidData = useMemo(() => {
    const traces: object[] = [];

    products.forEach((product, pi) => {
      const xaxis = pi === 0 ? 'x' : 'x2';
      const yaxis = pi === 0 ? 'y' : 'y2';

      const ps = botStates
        .filter((b) => b.product === product)
        .sort((a, b) => a.timestamp - b.timestamp);

      const ts = ps.map((b) => b.timestamp);
      const fair = ps.map((b) => b.fair);
      const mid = ps.map((b) => b.mid);

      // Green fill: fair > mid (cheap)
      traces.push({
        type: 'scatter', mode: 'lines', xaxis, yaxis,
        x: ts, y: fair.map((f, i) => f >= mid[i] ? f : mid[i]),
        line: { width: 0 }, showlegend: false, hoverinfo: 'skip',
      });
      traces.push({
        type: 'scatter', mode: 'lines', xaxis, yaxis,
        x: ts, y: fair.map((f, i) => f >= mid[i] ? mid[i] : f),
        fill: 'tonexty', fillcolor: 'rgba(166,227,161,0.2)',
        line: { width: 0 }, showlegend: false, hoverinfo: 'skip',
      });
      // Red fill: fair < mid (expensive)
      traces.push({
        type: 'scatter', mode: 'lines', xaxis, yaxis,
        x: ts, y: fair.map((f, i) => f < mid[i] ? mid[i] : f),
        line: { width: 0 }, showlegend: false, hoverinfo: 'skip',
      });
      traces.push({
        type: 'scatter', mode: 'lines', xaxis, yaxis,
        x: ts, y: fair.map((f, i) => f < mid[i] ? f : mid[i]),
        fill: 'tonexty', fillcolor: 'rgba(243,139,168,0.2)',
        line: { width: 0 }, showlegend: false, hoverinfo: 'skip',
      });

      // Mid line
      traces.push({
        type: 'scatter', mode: 'lines', xaxis, yaxis,
        x: ts, y: mid,
        name: `${product} Mid`,
        line: { color: '#a6adc8', width: 1.5 },
        hovertemplate: 'ts=%{x}<br>mid=%{y:.2f}<extra>' + product + ' Mid</extra>',
      });
      // Fair line
      traces.push({
        type: 'scatter', mode: 'lines', xaxis, yaxis,
        x: ts, y: fair,
        name: `${product} Fair`,
        line: { color: '#f9e2af', width: 1.5, dash: 'dash' },
        hovertemplate: 'ts=%{x}<br>fair=%{y:.2f}<extra>' + product + ' Fair</extra>',
      });

      // Trade markers (SUBMISSION fills only)
      const buys = trades.filter((t) => t.symbol === product && t.submissionSide === 'buy');
      const sells = trades.filter((t) => t.symbol === product && t.submissionSide === 'sell');
      if (buys.length > 0) {
        traces.push({
          type: 'scatter', mode: 'markers', xaxis, yaxis,
          x: buys.map((t) => t.timestamp), y: buys.map((t) => t.price),
          name: `${product} Buy`,
          marker: { symbol: 'triangle-up', size: 8, color: '#a6e3a1', line: { color: '#1e1e2e', width: 1 } },
          hovertemplate: 'ts=%{x}<br>BUY @%{y}<extra>' + product + '</extra>',
        });
      }
      if (sells.length > 0) {
        traces.push({
          type: 'scatter', mode: 'markers', xaxis, yaxis,
          x: sells.map((t) => t.timestamp), y: sells.map((t) => t.price),
          name: `${product} Sell`,
          marker: { symbol: 'triangle-down', size: 8, color: '#f38ba8', line: { color: '#1e1e2e', width: 1 } },
          hovertemplate: 'ts=%{x}<br>SELL @%{y}<extra>' + product + '</extra>',
        });
      }
    });

    return traces;
  }, [botStates, trades, products]);

  const fairMidLayout = useMemo(() => {
    const layout: Record<string, unknown> = {
      plot_bgcolor: PLOT_BG, paper_bgcolor: PAPER_BG,
      font: { color: TEXT_COLOR, size: 11 },
      hovermode: 'x unified',
      margin: { t: 20, r: 10, b: 40, l: 55 },
      shapes: buildModeShapes(allSortedStates, activeTimestamp),
      legend: { orientation: 'h', y: -0.18, font: { size: 10 } },
    };
    if (products.length >= 2) {
      layout['xaxis']  = { title: products[0], color: TEXT_COLOR, gridcolor: GRID_COLOR, domain: [0, 0.47] };
      layout['yaxis']  = { title: 'Price', color: TEXT_COLOR, gridcolor: GRID_COLOR };
      layout['xaxis2'] = { title: products[1], color: TEXT_COLOR, gridcolor: GRID_COLOR, domain: [0.53, 1.0], anchor: 'y2' };
      layout['yaxis2'] = { title: 'Price', color: TEXT_COLOR, gridcolor: GRID_COLOR, anchor: 'x2' };
    } else {
      layout['xaxis'] = { title: 'Timestamp (ms)', color: TEXT_COLOR, gridcolor: GRID_COLOR };
      layout['yaxis'] = { title: 'Price', color: TEXT_COLOR, gridcolor: GRID_COLOR };
    }
    return layout;
  }, [botStates, products, allSortedStates, activeTimestamp]);

  // ── Chart 2: Imbalance Timeline ────────────────────────────────────────────
  const imbalanceData = useMemo(() => {
    const traces: object[] = [];
    for (const product of products) {
      const ps = botStates
        .filter((b) => b.product === product)
        .sort((a, b) => a.timestamp - b.timestamp);

      traces.push({
        type: 'scatter', mode: 'lines',
        x: ps.map((b) => b.timestamp),
        y: ps.map((b) => b.imbalance),
        name: product,
        line: { color: PRODUCT_COLORS[product] ?? '#888', width: 1.5 },
        fill: 'tozeroy',
        fillcolor: (PRODUCT_COLORS[product] ?? '#888') + '33',
        hovertemplate: 'ts=%{x}<br>I=%{y:.3f}<extra>' + product + '</extra>',
      });
    }
    return traces;
  }, [botStates, products]);

  const imbalanceLayout = useMemo(() => ({
    xaxis: { title: 'Timestamp (ms)', color: TEXT_COLOR, gridcolor: GRID_COLOR },
    yaxis: { title: 'Imbalance (I)', color: TEXT_COLOR, gridcolor: GRID_COLOR, zeroline: true, zerolinecolor: '#45475a' },
    shapes: buildModeShapes(allSortedStates, activeTimestamp),
    margin: { t: 20, r: 10, b: 40, l: 60 },
    plot_bgcolor: PLOT_BG, paper_bgcolor: PAPER_BG,
    font: { color: TEXT_COLOR, size: 11 },
    hovermode: 'x unified',
    legend: { orientation: 'h', y: -0.2 },
  }), [allSortedStates, activeTimestamp]);

  // ── Chart 3: TOMATOES MR Signals ──────────────────────────────────────────
  const tomatoStates = useMemo(() =>
    botStates
      .filter((b) => b.product === 'TOMATOES' && b.ewma !== undefined)
      .sort((a, b) => a.timestamp - b.timestamp),
    [botStates],
  );

  const ewmaSignalData = useMemo(() => {
    if (tomatoStates.length === 0) return [];
    const ts = tomatoStates.map((b) => b.timestamp);
    return [
      {
        type: 'scatter', mode: 'lines', x: ts,
        y: tomatoStates.map((b) => b.mid),
        name: 'Mid', line: { color: '#a6adc8', width: 1.5 },
        hovertemplate: 'ts=%{x}<br>mid=%{y:.2f}<extra>Mid</extra>',
      },
      {
        type: 'scatter', mode: 'lines', x: ts,
        y: tomatoStates.map((b) => b.fair),
        name: 'Fair', line: { color: '#f9e2af', width: 1.5, dash: 'dash' },
        hovertemplate: 'ts=%{x}<br>fair=%{y:.2f}<extra>Fair</extra>',
      },
      {
        type: 'scatter', mode: 'lines', x: ts,
        y: tomatoStates.map((b) => b.ewma),
        name: 'EWMA', line: { color: '#cba6f7', width: 1.2, dash: 'dot' },
        hovertemplate: 'ts=%{x}<br>ewma=%{y:.2f}<extra>EWMA</extra>',
      },
      // Signal divergence in lower panel
      {
        type: 'scatter', mode: 'lines', x: ts,
        y: tomatoStates.map((b) => b.fair - (b.ewma ?? b.fair)),
        name: 'fair−ewma', yaxis: 'y2',
        line: { color: '#f9e2af', width: 1.5 },
        fill: 'tozeroy', fillcolor: 'rgba(249,226,175,0.15)',
        hovertemplate: 'ts=%{x}<br>fair−ewma=%{y:.2f}<extra>MR Divergence</extra>',
      },
      {
        type: 'scatter', mode: 'lines', x: ts,
        y: tomatoStates.map((b) => b.dMid ?? 0),
        name: 'dMid', yaxis: 'y2',
        line: { color: '#89dceb', width: 1, dash: 'dot' },
        hovertemplate: 'ts=%{x}<br>dMid=%{y:.2f}<extra>Price Velocity</extra>',
      },
    ];
  }, [tomatoStates]);

  const ewmaLayout = useMemo(() => ({
    xaxis: { title: 'Timestamp (ms)', color: TEXT_COLOR, gridcolor: GRID_COLOR },
    yaxis: { title: 'Price', color: TEXT_COLOR, gridcolor: GRID_COLOR, domain: [0.35, 1.0] },
    yaxis2: {
      title: 'Signal strength', color: '#f9e2af', gridcolor: GRID_COLOR,
      domain: [0, 0.30], zeroline: true, zerolinecolor: '#45475a',
    },
    shapes: buildModeShapes(tomatoStates, activeTimestamp),
    margin: { t: 20, r: 10, b: 40, l: 60 },
    plot_bgcolor: PLOT_BG, paper_bgcolor: PAPER_BG,
    font: { color: TEXT_COLOR, size: 11 },
    hovermode: 'x unified',
    legend: { orientation: 'h', y: -0.15, font: { size: 10 } },
  }), [tomatoStates, activeTimestamp]);

  // ── Chart 4: Imbalance Predictive Power ────────────────────────────────────
  const scatterData = useMemo(() => {
    const traces: object[] = [];
    for (const product of products) {
      const productRows = bookRows
        .filter((r) => r.product === product)
        .sort((a, b) => a.timestamp - b.timestamp);
      const tsMap = new Map<number, number>();
      productRows.forEach((r, i) => tsMap.set(r.timestamp, i));

      const ps = botStates
        .filter((b) => b.product === product)
        .sort((a, b) => a.timestamp - b.timestamp);

      const xs: number[] = [], ys: number[] = [];
      const colors: string[] = [], texts: string[] = [];

      for (const bs of ps) {
        const idx = tsMap.get(bs.timestamp);
        if (idx === undefined || idx + 1 >= productRows.length) continue;
        const dMid = productRows[idx + 1].midPrice - productRows[idx].midPrice;
        xs.push(bs.imbalance);
        ys.push(dMid);
        const active = bs.mode !== 'passive' && bs.mode !== 'skip';
        colors.push(active ? (PRODUCT_COLORS[product] ?? '#888') : '#45475a');
        texts.push(`${bs.mode} @ ts=${bs.timestamp}`);
      }

      traces.push({
        type: 'scatter', mode: 'markers',
        x: xs, y: ys, name: product, text: texts,
        marker: { color: colors, size: 5, opacity: 0.65 },
        hovertemplate: 'I=%{x:.3f}<br>dMid=%{y:.2f}<br>%{text}<extra>' + product + '</extra>',
      });
    }
    return traces;
  }, [botStates, bookRows, products]);

  const scatterLayout = {
    xaxis: { title: 'Imbalance (I)', color: TEXT_COLOR, gridcolor: GRID_COLOR, zeroline: true, zerolinecolor: '#45475a' },
    yaxis: { title: 'Next-tick dMid', color: TEXT_COLOR, gridcolor: GRID_COLOR, zeroline: true, zerolinecolor: '#45475a' },
    annotations: [
      { x: 0.28, y: 4,  xref: 'x', yref: 'y', text: 'signal works ✓', showarrow: false, font: { color: '#a6e3a1', size: 9 } },
      { x: -0.28, y: -4, xref: 'x', yref: 'y', text: 'signal works ✓', showarrow: false, font: { color: '#a6e3a1', size: 9 } },
      { x: 0.28, y: -4, xref: 'x', yref: 'y', text: 'false signal ✗', showarrow: false, font: { color: '#f38ba8', size: 9 } },
      { x: -0.28, y: 4,  xref: 'x', yref: 'y', text: 'false signal ✗', showarrow: false, font: { color: '#f38ba8', size: 9 } },
    ],
    margin: { t: 20, r: 10, b: 50, l: 60 },
    plot_bgcolor: PLOT_BG, paper_bgcolor: PAPER_BG,
    font: { color: TEXT_COLOR, size: 11 },
    hovermode: 'closest',
    legend: { orientation: 'h', y: -0.2 },
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'auto', padding: 8, gap: 8 }}>
      <div style={{ color: '#89b4fa', fontSize: 13, fontWeight: 'bold' }}>Signal Diagnostics</div>

      {/* Mode legend */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        {Object.entries(MODE_LABELS).map(([mode, label]) => (
          <span key={mode} style={{
            padding: '2px 8px', borderRadius: 10, fontSize: 10,
            background: (MODE_COLORS[mode as keyof typeof MODE_COLORS] ?? '#313244') + '33',
            border: `1px solid ${MODE_COLORS[mode as keyof typeof MODE_COLORS] ?? '#313244'}`,
            color: MODE_COLORS[mode as keyof typeof MODE_COLORS] ?? '#cdd6f4',
          }}>
            {label}
          </span>
        ))}
        <span style={{ color: '#585b70', fontSize: 10 }}>background strips = active mode</span>
      </div>

      {/* Chart 1: Fair vs Mid */}
      <div style={{ background: '#181825', border: '1px solid #313244', borderRadius: 6, overflow: 'hidden', height: 280 }}>
        <div style={{ color: '#7f849c', fontSize: 10, padding: '4px 8px' }}>
          Fair value vs market price — 🟢 green fill = market cheap (buy signal) · 🔴 red fill = expensive (sell signal) · ▲▼ = fills
        </div>
        <PlotlyWrapper data={fairMidData} layout={fairMidLayout} onClick={handleClick} style={{ width: '100%', height: 250 }} />
      </div>

      {/* Chart 2: Imbalance */}
      <div style={{ background: '#181825', border: '1px solid #313244', borderRadius: 6, overflow: 'hidden', height: 210 }}>
        <div style={{ color: '#7f849c', fontSize: 10, padding: '4px 8px' }}>
          Order book imbalance — positive = more buyers, negative = more sellers. Background strips show when bot acted on it.
        </div>
        <PlotlyWrapper data={imbalanceData} layout={imbalanceLayout} onClick={handleClick} style={{ width: '100%', height: 180 }} />
      </div>

      {/* Chart 3: TOMATOES MR signals */}
      {tomatoStates.length > 0 && (
        <div style={{ background: '#181825', border: '1px solid #313244', borderRadius: 6, overflow: 'hidden', height: 260 }}>
          <div style={{ color: '#7f849c', fontSize: 10, padding: '4px 8px' }}>
            TOMATOES mean-reversion signals — top: fair / mid / ewma · bottom: fair−ewma divergence + dMid velocity
          </div>
          <PlotlyWrapper data={ewmaSignalData} layout={ewmaLayout} onClick={handleClick} style={{ width: '100%', height: 230 }} />
        </div>
      )}

      {/* Chart 4: Scatter */}
      <div style={{ background: '#181825', border: '1px solid #313244', borderRadius: 6, overflow: 'hidden', height: 260 }}>
        <div style={{ color: '#7f849c', fontSize: 10, padding: '4px 8px' }}>
          Imbalance signal quality — does I predict the next price move? Bright = bot was in active mode, grey = passive
        </div>
        <PlotlyWrapper data={scatterData} layout={scatterLayout} style={{ width: '100%', height: 230 }} />
      </div>
    </div>
  );
}
