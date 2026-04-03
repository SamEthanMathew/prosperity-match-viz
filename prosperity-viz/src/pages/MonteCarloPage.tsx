import { useCallback, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { PlotlyWrapper } from '../components/shared/PlotlyWrapper';
import { PRODUCT_COLORS } from '../types/data';
import type { MCDashboard, MCBandSeries, MCDistribution } from '../types/montecarlo';

// ── Theme constants (match rest of app) ──────────────────────────────────────
const PLOT_BG = '#1e1e2e';
const PAPER_BG = '#181825';
const TEXT_COLOR = '#cdd6f4';
const GRID_COLOR = '#313244';
const CARD_STYLE: React.CSSProperties = {
  background: '#181825',
  border: '1px solid #313244',
  borderRadius: 6,
  padding: 12,
};

const TOTAL_COLOR = '#89b4fa';
const EMERALD_COLOR = PRODUCT_COLORS['EMERALDS'] ?? '#a6e3a1';
const TOMATO_COLOR = PRODUCT_COLORS['TOMATOES'] ?? '#fab387';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number, decimals = 1): string {
  return n.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function pctFmt(n: number): string {
  return (n * 100).toFixed(1) + '%';
}

function signColor(n: number): string {
  return n > 0 ? '#a6e3a1' : n < 0 ? '#f38ba8' : '#cdd6f4';
}

function gaussianY(x: number, mu: number, sigma: number): number {
  return Math.exp(-0.5 * ((x - mu) / sigma) ** 2) / (sigma * Math.sqrt(2 * Math.PI));
}

// Build normal fit curve scaled to histogram area
function buildNormalFitTrace(
  edges: number[],
  counts: number[],
  mu: number,
  sigma: number,
  color: string,
) {
  const binWidth = edges.length > 1 ? edges[1] - edges[0] : 1;
  const totalArea = counts.reduce((s, c) => s + c, 0) * binWidth;
  const xs: number[] = [];
  const ys: number[] = [];
  const steps = 200;
  const xMin = edges[0];
  const xMax = edges[edges.length - 1];
  for (let i = 0; i <= steps; i++) {
    const x = xMin + (xMax - xMin) * (i / steps);
    xs.push(x);
    ys.push(gaussianY(x, mu, sigma) * totalArea);
  }
  return {
    type: 'scatter',
    mode: 'lines',
    x: xs,
    y: ys,
    line: { color, width: 2, dash: 'dash' },
    showlegend: false,
    hoverinfo: 'skip',
  };
}

// Build histogram bar trace from edges + counts
function buildHistTrace(edges: number[], counts: number[], color: string, name: string) {
  const binWidth = edges.length > 1 ? edges[1] - edges[0] : 1;
  const xCenters = edges.slice(0, -1).map((e, i) => e + (edges[i + 1] - e) / 2);
  return {
    type: 'bar',
    x: xCenters.length ? xCenters : edges.slice(0, counts.length).map((e, i) => e + binWidth / 2),
    y: counts,
    width: binWidth * 0.9,
    name,
    marker: { color, opacity: 0.7 },
    hovertemplate: `${name}: %{x:.1f}<br>Count: %{y}<extra></extra>`,
  };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  return (
    <div style={{ ...CARD_STYLE, minWidth: 140, flex: 1 }}>
      <div style={{ color: '#7f849c', fontSize: 10, marginBottom: 4 }}>{label}</div>
      <div style={{ color: color ?? TEXT_COLOR, fontSize: 18, fontWeight: 'bold', fontFamily: 'monospace' }}>
        {value}
      </div>
      {sub && <div style={{ color: '#6c7086', fontSize: 10, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function DistHistogram({
  title,
  histKey,
  db,
  color,
}: {
  title: string;
  histKey: string;
  db: MCDashboard;
  color: string;
}) {
  const hist = db.histograms[histKey];
  const fit = db.normalFits[histKey];
  const dist: MCDistribution =
    histKey === 'totalPnl'
      ? db.overall.totalPnl
      : histKey === 'emeraldPnl'
        ? db.overall.emeraldPnl
        : db.overall.tomatoPnl;

  const data = useMemo(() => {
    if (!hist) return [];
    const traces: object[] = [buildHistTrace(hist.edges, hist.counts, color, title)];
    if (fit) traces.push(buildNormalFitTrace(hist.edges, hist.counts, fit.mu, fit.sigma, '#cdd6f4'));
    return traces;
  }, [hist, fit, color, title]);

  const layout = useMemo(() => {
    const shapes: object[] = [
      { type: 'line', x0: dist.mean, x1: dist.mean, y0: 0, y1: 1, yref: 'paper', line: { color: '#f9e2af', width: 1.5, dash: 'dot' } },
      { type: 'line', x0: dist.var95, x1: dist.var95, y0: 0, y1: 1, yref: 'paper', line: { color: '#fab387', width: 1.5, dash: 'dash' } },
    ];
    return {
      xaxis: { color: TEXT_COLOR, gridcolor: GRID_COLOR, title: 'PnL' },
      yaxis: { color: TEXT_COLOR, gridcolor: GRID_COLOR, title: 'Sessions' },
      barmode: 'overlay',
      margin: { t: 10, r: 10, b: 40, l: 50 },
      plot_bgcolor: PLOT_BG,
      paper_bgcolor: PAPER_BG,
      font: { color: TEXT_COLOR, size: 10 },
      showlegend: false,
      shapes,
      annotations: fit
        ? [{ x: 0.98, y: 0.98, xref: 'paper', yref: 'paper', text: `Normal R²=${fit.r2.toFixed(2)}`, showarrow: false, font: { color: '#6c7086', size: 9 }, xanchor: 'right', yanchor: 'top' }]
        : [],
    };
  }, [dist, fit]);

  return (
    <div style={{ ...CARD_STYLE, flex: 1, minWidth: 0 }}>
      <div style={{ color, fontSize: 11, fontWeight: 'bold', marginBottom: 4 }}>{title}</div>
      <div style={{ color: '#6c7086', fontSize: 10, marginBottom: 6 }}>
        yellow=mean · orange=VaR95 · dashed=normal fit
      </div>
      <PlotlyWrapper data={data} layout={layout} style={{ width: '100%', height: 200 }} />
    </div>
  );
}

function BandChart({ db }: { db: MCDashboard }) {
  const [product, setProduct] = useState<string>('TOTAL');
  const products = useMemo(() => Object.keys(db.bandSeries ?? {}), [db]);

  const color = product === 'TOTAL' ? TOTAL_COLOR : product === 'EMERALDS' ? EMERALD_COLOR : TOMATO_COLOR;

  const data = useMemo(() => {
    const bs: MCBandSeries | undefined = db.bandSeries?.[product];
    if (!bs) return [];
    const ts = bs.timestamps;
    return [
      // p95 — invisible top of outer band
      { type: 'scatter', mode: 'lines', x: ts, y: bs.p95, line: { width: 0, color: 'transparent' }, showlegend: false, hoverinfo: 'skip' },
      // p05 — fills down to p95 (outer 90% band)
      { type: 'scatter', mode: 'lines', x: ts, y: bs.p05, fill: 'tonexty', fillcolor: `${color}22`, line: { width: 0 }, name: 'p05–p95', hoverinfo: 'skip' },
      // p75 — invisible top of inner band
      { type: 'scatter', mode: 'lines', x: ts, y: bs.p75, line: { width: 0, color: 'transparent' }, showlegend: false, hoverinfo: 'skip' },
      // p25 — fills down to p75 (inner 50% band)
      { type: 'scatter', mode: 'lines', x: ts, y: bs.p25, fill: 'tonexty', fillcolor: `${color}44`, line: { width: 0 }, name: 'p25–p75', hoverinfo: 'skip' },
      // median
      { type: 'scatter', mode: 'lines', x: ts, y: bs.p50, name: 'Median', line: { color, width: 2 }, hovertemplate: 'ts=%{x}<br>median=%{y:.1f}<extra></extra>' },
      // mean
      { type: 'scatter', mode: 'lines', x: ts, y: bs.mean, name: 'Mean', line: { color: '#f9e2af', width: 1.5, dash: 'dash' }, hovertemplate: 'ts=%{x}<br>mean=%{y:.1f}<extra></extra>' },
    ];
  }, [db, product, color]);

  const layout = useMemo(() => ({
    xaxis: { title: 'Timestamp', color: TEXT_COLOR, gridcolor: GRID_COLOR },
    yaxis: { title: 'PnL', color: TEXT_COLOR, gridcolor: GRID_COLOR, zeroline: true, zerolinecolor: '#45475a' },
    margin: { t: 10, r: 10, b: 40, l: 60 },
    plot_bgcolor: PLOT_BG,
    paper_bgcolor: PAPER_BG,
    font: { color: TEXT_COLOR, size: 10 },
    hovermode: 'x unified',
    legend: { orientation: 'h', y: -0.25 },
  }), []);

  if (products.length === 0) return null;

  return (
    <div style={CARD_STYLE}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ color: '#89b4fa', fontSize: 12, fontWeight: 'bold' }}>Quantile Bands Over Time</span>
        <span style={{ color: '#7f849c', fontSize: 10 }}>p05/p25/p50/p75/p95 across all sessions</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
          {products.map((p) => (
            <button
              key={p}
              onClick={() => setProduct(p)}
              style={{
                padding: '2px 8px',
                fontSize: 10,
                borderRadius: 3,
                border: `1px solid ${product === p ? '#89b4fa' : '#313244'}`,
                background: product === p ? '#89b4fa22' : 'transparent',
                color: product === p ? '#89b4fa' : '#7f849c',
                cursor: 'pointer',
              }}
            >
              {p}
            </button>
          ))}
        </div>
      </div>
      <PlotlyWrapper data={data} layout={layout} style={{ width: '100%', height: 230 }} />
    </div>
  );
}

function RiskTable({ db }: { db: MCDashboard }) {
  const rows = [
    { label: 'TOTAL', dist: db.overall.totalPnl, color: TOTAL_COLOR },
    { label: 'EMERALDS', dist: db.overall.emeraldPnl, color: EMERALD_COLOR },
    { label: 'TOMATOES', dist: db.overall.tomatoPnl, color: TOMATO_COLOR },
  ];

  const COL: React.CSSProperties = { padding: '6px 10px', fontSize: 11, fontFamily: 'monospace', textAlign: 'right', borderBottom: '1px solid #313244' };
  const HDR: React.CSSProperties = { ...COL, color: '#7f849c', fontSize: 10, fontWeight: 'bold', fontFamily: 'inherit', background: '#1e1e2e', textAlign: 'right' };
  const LABEL: React.CSSProperties = { ...COL, textAlign: 'left', fontFamily: 'inherit', fontWeight: 'bold' };

  return (
    <div style={CARD_STYLE}>
      <div style={{ color: '#89b4fa', fontSize: 12, fontWeight: 'bold', marginBottom: 8 }}>Risk Metrics</div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr>
              {['Product', 'Mean', 'Std', 'Sharpe', 'Sortino', 'Skew', 'VaR95', 'CVaR95', '+Rate', '−Rate'].map((h) => (
                <th key={h} style={HDR}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ label, dist, color }) => (
              <tr key={label}>
                <td style={{ ...LABEL, color }}>{label}</td>
                <td style={{ ...COL, color: signColor(dist.mean) }}>{fmt(dist.mean)}</td>
                <td style={COL}>{fmt(dist.std)}</td>
                <td style={{ ...COL, color: signColor(dist.sharpeLike) }}>{dist.sharpeLike.toFixed(3)}</td>
                <td style={{ ...COL, color: signColor(dist.sortinoLike) }}>{dist.sortinoLike.toFixed(3)}</td>
                <td style={{ ...COL, color: dist.skewness < -0.5 ? '#f38ba8' : dist.skewness > 0.5 ? '#a6e3a1' : TEXT_COLOR }}>{dist.skewness.toFixed(2)}</td>
                <td style={{ ...COL, color: '#fab387' }}>{fmt(dist.var95)}</td>
                <td style={{ ...COL, color: '#f38ba8' }}>{fmt(dist.cvar95)}</td>
                <td style={{ ...COL, color: '#a6e3a1' }}>{pctFmt(dist.positiveRate)}</td>
                <td style={{ ...COL, color: '#f38ba8' }}>{pctFmt(dist.negativeRate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ScatterPlot({ db }: { db: MCDashboard }) {
  const topIds = useMemo(() => new Set(db.topSessions.map((s) => s.session_id)), [db]);
  const botIds = useMemo(() => new Set(db.bottomSessions.map((s) => s.session_id)), [db]);

  const normal = db.sessions.filter((s) => !topIds.has(s.session_id) && !botIds.has(s.session_id));
  const top = db.sessions.filter((s) => topIds.has(s.session_id));
  const bot = db.sessions.filter((s) => botIds.has(s.session_id));

  // Regression line range
  const xs = db.sessions.map((s) => s.emerald_pnl);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const { slope, intercept, r2 } = db.scatterFit;
  const regX = [xMin, xMax];
  const regY = regX.map((x) => slope * x + intercept);

  const data = [
    { type: 'scatter', mode: 'markers', x: normal.map((s) => s.emerald_pnl), y: normal.map((s) => s.tomato_pnl), name: 'Sessions', marker: { color: '#585b70', size: 4, opacity: 0.6 }, hovertemplate: 'E=%{x:.0f}<br>T=%{y:.0f}<extra></extra>' },
    { type: 'scatter', mode: 'markers', x: top.map((s) => s.emerald_pnl), y: top.map((s) => s.tomato_pnl), name: 'Top 10', marker: { color: '#a6e3a1', size: 8, symbol: 'star' }, hovertemplate: 'E=%{x:.0f}<br>T=%{y:.0f}<extra>Top</extra>' },
    { type: 'scatter', mode: 'markers', x: bot.map((s) => s.emerald_pnl), y: bot.map((s) => s.tomato_pnl), name: 'Bottom 10', marker: { color: '#f38ba8', size: 8, symbol: 'x' }, hovertemplate: 'E=%{x:.0f}<br>T=%{y:.0f}<extra>Bottom</extra>' },
    { type: 'scatter', mode: 'lines', x: regX, y: regY, name: 'Fit', line: { color: '#f9e2af', width: 1.5, dash: 'dash' }, hoverinfo: 'skip' },
  ];

  const layout = {
    xaxis: { title: 'EMERALDS PnL', color: TEXT_COLOR, gridcolor: GRID_COLOR, zeroline: true, zerolinecolor: '#45475a' },
    yaxis: { title: 'TOMATOES PnL', color: TEXT_COLOR, gridcolor: GRID_COLOR, zeroline: true, zerolinecolor: '#45475a' },
    margin: { t: 20, r: 10, b: 50, l: 60 },
    plot_bgcolor: PLOT_BG,
    paper_bgcolor: PAPER_BG,
    font: { color: TEXT_COLOR, size: 10 },
    legend: { orientation: 'h', y: -0.25 },
    annotations: [
      { x: 0.98, y: 0.98, xref: 'paper', yref: 'paper', text: `ρ=${db.overall.emeraldTomatoCorrelation.toFixed(2)}  R²=${r2.toFixed(2)}`, showarrow: false, font: { color: '#89b4fa', size: 10 }, xanchor: 'right', yanchor: 'top' },
      { x: 0.02, y: 0.98, xref: 'paper', yref: 'paper', text: 'TOMATOES only', showarrow: false, font: { color: '#585b70', size: 9 }, xanchor: 'left', yanchor: 'top' },
      { x: 0.98, y: 0.02, xref: 'paper', yref: 'paper', text: 'EMERALDS only', showarrow: false, font: { color: '#585b70', size: 9 }, xanchor: 'right', yanchor: 'bottom' },
      { x: 0.98, y: 0.98, xref: 'paper', yref: 'paper', text: '', showarrow: false },
      { x: 0.02, y: 0.02, xref: 'paper', yref: 'paper', text: 'Both lose', showarrow: false, font: { color: '#585b70', size: 9 }, xanchor: 'left', yanchor: 'bottom' },
    ],
  };

  return (
    <div style={CARD_STYLE}>
      <div style={{ color: '#89b4fa', fontSize: 12, fontWeight: 'bold', marginBottom: 4 }}>EMERALDS vs TOMATOES PnL Correlation</div>
      <div style={{ color: '#7f849c', fontSize: 10, marginBottom: 4 }}>Each dot = one session · ⭐ top 10 · ✕ bottom 10 · dashed = regression</div>
      <PlotlyWrapper data={data} layout={layout} style={{ width: '100%', height: 280 }} />
    </div>
  );
}

type SortKey = 'session_id' | 'total_pnl' | 'emerald_pnl' | 'tomato_pnl' | 'total_slope_per_step' | 'total_r2';

function SessionTable({ db }: { db: MCDashboard }) {
  const [sortKey, setSortKey] = useState<SortKey>('total_pnl');
  const [sortAsc, setSortAsc] = useState(false);
  const parentRef = useRef<HTMLDivElement>(null);

  const topIds = useMemo(() => new Set(db.topSessions.map((s) => s.session_id)), [db]);
  const botIds = useMemo(() => new Set(db.bottomSessions.map((s) => s.session_id)), [db]);

  const sorted = useMemo(() => {
    const arr = [...db.sessions].sort((a, b) => {
      const va = a[sortKey] ?? 0;
      const vb = b[sortKey] ?? 0;
      return sortAsc ? (va as number) - (vb as number) : (vb as number) - (va as number);
    });
    return arr;
  }, [db.sessions, sortKey, sortAsc]);

  const rowVirtualizer = useVirtualizer({
    count: sorted.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 28,
    overscan: 10,
  });

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc((v) => !v);
    else { setSortKey(key); setSortAsc(false); }
  };

  const HDR: React.CSSProperties = { padding: '5px 10px', fontSize: 10, color: '#7f849c', textAlign: 'right', cursor: 'pointer', userSelect: 'none', borderBottom: '1px solid #313244', whiteSpace: 'nowrap' };
  const CELL: React.CSSProperties = { padding: '4px 10px', fontSize: 11, fontFamily: 'monospace', textAlign: 'right' };

  const cols: { key: SortKey; label: string }[] = [
    { key: 'session_id', label: 'Session' },
    { key: 'total_pnl', label: 'Total PnL' },
    { key: 'emerald_pnl', label: 'EMERALDS' },
    { key: 'tomato_pnl', label: 'TOMATOES' },
    { key: 'total_slope_per_step', label: 'Slope/step' },
    { key: 'total_r2', label: 'R²' },
  ];

  return (
    <div style={CARD_STYLE}>
      <div style={{ color: '#89b4fa', fontSize: 12, fontWeight: 'bold', marginBottom: 4 }}>Session Explorer</div>
      <div style={{ color: '#7f849c', fontSize: 10, marginBottom: 8 }}>
        <span style={{ color: '#a6e3a1' }}>■</span> top 10 &nbsp;
        <span style={{ color: '#f38ba8' }}>■</span> bottom 10 &nbsp;· click column to sort
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <thead>
            <tr style={{ background: '#1e1e2e' }}>
              <th style={{ ...HDR, textAlign: 'left', width: 40 }}>#</th>
              {cols.map((c) => (
                <th key={c.key} style={HDR} onClick={() => toggleSort(c.key)}>
                  {c.label} {sortKey === c.key ? (sortAsc ? '↑' : '↓') : ''}
                </th>
              ))}
            </tr>
          </thead>
        </table>
        <div ref={parentRef} style={{ height: Math.min(sorted.length * 28, 400), overflow: 'auto' }}>
          <div style={{ height: rowVirtualizer.getTotalSize(), position: 'relative' }}>
            {rowVirtualizer.getVirtualItems().map((vRow) => {
              const s = sorted[vRow.index];
              const isTop = topIds.has(s.session_id);
              const isBot = botIds.has(s.session_id);
              const borderColor = isTop ? '#a6e3a1' : isBot ? '#f38ba8' : 'transparent';
              return (
                <div
                  key={s.session_id}
                  style={{ position: 'absolute', top: vRow.start, width: '100%', height: 28, display: 'flex', borderLeft: `3px solid ${borderColor}`, borderBottom: '1px solid #31324444', alignItems: 'center' }}
                >
                  <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                    <tbody>
                      <tr>
                        <td style={{ ...CELL, textAlign: 'left', width: 40, color: '#6c7086' }}>{vRow.index + 1}</td>
                        <td style={{ ...CELL, color: '#a6adc8' }}>{s.session_id}</td>
                        <td style={{ ...CELL, color: signColor(s.total_pnl) }}>{fmt(s.total_pnl)}</td>
                        <td style={{ ...CELL, color: signColor(s.emerald_pnl) }}>{fmt(s.emerald_pnl)}</td>
                        <td style={{ ...CELL, color: signColor(s.tomato_pnl) }}>{fmt(s.tomato_pnl)}</td>
                        <td style={{ ...CELL, color: signColor(s.total_slope_per_step) }}>{s.total_slope_per_step.toExponential(2)}</td>
                        <td style={{ ...CELL, color: s.total_r2 > 0.5 ? '#a6e3a1' : TEXT_COLOR }}>{s.total_r2.toFixed(3)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function ProfitabilityCharts({ db }: { db: MCDashboard }) {
  const slopes = db.sessions.map((s) => s.total_slope_per_step);
  const r2s = db.sessions.map((s) => s.total_r2);

  const slopeData = [{ type: 'histogram', x: slopes, name: 'Slope/step', marker: { color: TOTAL_COLOR, opacity: 0.7 }, nbinsx: 30, hovertemplate: 'slope=%{x:.2e}<br>count=%{y}<extra></extra>' }];
  const r2Data = [{ type: 'histogram', x: r2s, name: 'R²', marker: { color: '#cba6f7', opacity: 0.7 }, nbinsx: 20, hovertemplate: 'R²=%{x:.3f}<br>count=%{y}<extra></extra>' }];

  const baseLayout = {
    margin: { t: 10, r: 10, b: 40, l: 50 },
    plot_bgcolor: PLOT_BG,
    paper_bgcolor: PAPER_BG,
    font: { color: TEXT_COLOR, size: 10 },
    showlegend: false,
  };

  const slopeLayout = {
    ...baseLayout,
    xaxis: { title: 'Slope per step', color: TEXT_COLOR, gridcolor: GRID_COLOR, zeroline: true, zerolinecolor: '#45475a' },
    yaxis: { title: 'Sessions', color: TEXT_COLOR, gridcolor: GRID_COLOR },
    shapes: [{ type: 'line', x0: 0, x1: 0, y0: 0, y1: 1, yref: 'paper', line: { color: '#f9e2af', width: 1, dash: 'dot' } }],
  };

  const r2Layout = {
    ...baseLayout,
    xaxis: { title: 'R² (stability)', color: TEXT_COLOR, gridcolor: GRID_COLOR, range: [0, 1] },
    yaxis: { title: 'Sessions', color: TEXT_COLOR, gridcolor: GRID_COLOR },
  };

  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <div style={{ ...CARD_STYLE, flex: 1, minWidth: 0 }}>
        <div style={{ color: '#89b4fa', fontSize: 11, fontWeight: 'bold', marginBottom: 4 }}>Profitability Distribution</div>
        <div style={{ color: '#7f849c', fontSize: 10, marginBottom: 4 }}>PnL slope per tick across sessions · yellow=zero</div>
        <PlotlyWrapper data={slopeData} layout={slopeLayout} style={{ width: '100%', height: 180 }} />
      </div>
      <div style={{ ...CARD_STYLE, flex: 1, minWidth: 0 }}>
        <div style={{ color: '#89b4fa', fontSize: 11, fontWeight: 'bold', marginBottom: 4 }}>Stability Distribution</div>
        <div style={{ color: '#7f849c', fontSize: 10, marginBottom: 4 }}>R² fit quality across sessions · higher = more consistent</div>
        <PlotlyWrapper data={r2Data} layout={r2Layout} style={{ width: '100%', height: 180 }} />
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function mcEndpoint(): string {
  const base = (import.meta.env.VITE_BACKTEST_API_URL as string | undefined)?.trim() || '';
  return base ? `${base.replace(/\/$/, '')}/api/montecarlo` : '/api/montecarlo';
}

function parseDashboardJson(text: string): MCDashboard {
  const parsed = JSON.parse(text) as { kind?: string };
  if (parsed.kind !== 'monte_carlo_dashboard') {
    throw new Error('Not a monte_carlo_dashboard JSON file.');
  }
  return parsed as MCDashboard;
}

// ── Run / upload form ─────────────────────────────────────────────────────────

function RunForm({ onLoad }: { onLoad: (db: MCDashboard) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [fileWarning, setFileWarning] = useState<string | null>(null);
  const [preset, setPreset] = useState<'quick' | 'heavy'>('quick');
  const [sessions, setSessions] = useState('');
  const [loading, setLoading] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [showJsonUpload, setShowJsonUpload] = useState(false);
  const [jsonDragOver, setJsonDragOver] = useState(false);
  const [pyDragOver, setPyDragOver] = useState(false);
  const jsonInputRef = useRef<HTMLInputElement>(null);
  const pyInputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const onFileChange = useCallback(async (f: File | null) => {
    setFile(f);
    setFileWarning(null);
    if (!f) return;
    if (!f.name.toLowerCase().endsWith('.py')) {
      setFileWarning('Please choose a .py file.');
      return;
    }
    const text = await f.text();
    if (!/\bclass\s+Trader\b/.test(text)) {
      setFileWarning('No "class Trader" found in file.');
    }
  }, []);

  const runBacktest = useCallback(async () => {
    if (!file) return;
    setError(null);
    setLoading(true);
    setElapsed(0);
    timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);

    try {
      const fd = new FormData();
      fd.append('trader', file);
      fd.append('preset', preset);
      if (sessions.trim()) fd.append('sessions', sessions.trim());

      let res: Response;
      try {
        res = await fetch(mcEndpoint(), { method: 'POST', body: fd });
      } catch {
        throw new Error('Cannot reach the backtest API. Make sure it is running:\n  cd backtest-api && npm install && npm start');
      }
      if (!res.ok) {
        if (res.status === 502 || res.status === 503 || res.status === 504) {
          throw new Error(`Backtest API is not reachable (${res.status}). Make sure it is running:\n  cd backtest-api && npm install && npm start`);
        }
        const ct = res.headers.get('content-type') || '';
        if (ct.includes('application/json')) {
          const j = (await res.json()) as { error?: string };
          throw new Error(j.error || `Request failed (${res.status})`);
        }
        throw new Error((await res.text()) || `Request failed (${res.status})`);
      }
      const text = await res.text();
      onLoad(parseDashboardJson(text));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }, [file, preset, sessions, onLoad]);

  const processJsonFile = useCallback(async (f: File) => {
    setError(null);
    try {
      onLoad(parseDashboardJson(await f.text()));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [onLoad]);

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 10px', background: '#313244',
    border: '1px solid #45475a', borderRadius: 6, color: '#cdd6f4', fontSize: 13,
  };

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100%', padding: 24 }}
      onDragOver={(e) => { e.preventDefault(); if (!loading) setPyDragOver(true); }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setPyDragOver(false); }}
      onDrop={(e) => { e.preventDefault(); setPyDragOver(false); if (!loading) { const f = e.dataTransfer.files[0]; if (f) void onFileChange(f); } }}
    >
      <div style={{ width: '100%', maxWidth: 560 }}>
        <h2 style={{ color: '#89b4fa', fontSize: 18, margin: '0 0 6px' }}>Monte Carlo Backtest</h2>
        <p style={{ color: '#7f849c', fontSize: 12, lineHeight: 1.6, marginBottom: 24 }}>
          Drop your <code style={{ color: '#89dceb' }}>trader.py</code> and the server runs{' '}
          <code style={{ color: '#89dceb' }}>prosperity4mcbt</code> for you. Make sure the backtest API is
          running and <code style={{ color: '#89dceb' }}>MC_BIN</code> is configured in its <code style={{ color: '#89dceb' }}>.env</code>.
        </p>

        {/* Trader file */}
        <label style={{ display: 'block', fontSize: 12, color: '#a6adc8', marginBottom: 6 }}>Trader (.py)</label>
        <div
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); if (!loading) setPyDragOver(true); }}
          onDragLeave={(e) => { e.stopPropagation(); setPyDragOver(false); }}
          onDrop={(e) => { e.preventDefault(); e.stopPropagation(); setPyDragOver(false); if (!loading) { const f = e.dataTransfer.files[0]; if (f) void onFileChange(f); } }}
          onClick={() => !loading && pyInputRef.current?.click()}
          style={{
            border: `2px dashed ${pyDragOver ? '#89b4fa' : '#45475a'}`,
            borderRadius: 8, padding: '20px', textAlign: 'center',
            cursor: loading ? 'not-allowed' : 'pointer',
            background: pyDragOver ? '#89b4fa11' : '#181825',
            transition: 'border-color 0.15s, background 0.15s',
            marginBottom: 6,
          }}
        >
          {file ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: '#cdd6f4', fontSize: 13 }}>
              <span>📄 {file.name}</span>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); void onFileChange(null); }}
                style={{ background: 'transparent', border: 'none', color: '#7f849c', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: '0 2px' }}
                title="Clear file"
              >×</button>
            </div>
          ) : (
            <>
              <div style={{ color: '#cdd6f4', fontSize: 13, marginBottom: 4 }}>Drop trader.py here</div>
              <div style={{ color: '#7f849c', fontSize: 11 }}>or click to select</div>
            </>
          )}
          <input
            ref={pyInputRef}
            type="file"
            accept=".py,text/x-python"
            style={{ display: 'none' }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFileChange(f); }}
          />
        </div>
        {fileWarning && <div style={{ fontSize: 11, color: '#fab387', marginBottom: 10 }}>{fileWarning}</div>}

        {/* Preset + sessions row */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, marginTop: 8 }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: 12, color: '#a6adc8', marginBottom: 6 }}>Preset</label>
            <select
              value={preset}
              disabled={loading}
              onChange={(e) => setPreset(e.target.value as 'quick' | 'heavy')}
              style={{ ...inputStyle }}
            >
              <option value="quick">Quick — 100 sessions (~1 min)</option>
              <option value="heavy">Heavy — 1000 sessions (~10 min)</option>
            </select>
          </div>
          <div style={{ width: 140 }}>
            <label style={{ display: 'block', fontSize: 12, color: '#a6adc8', marginBottom: 6 }}>Sessions (override)</label>
            <input
              value={sessions}
              onChange={(e) => setSessions(e.target.value)}
              placeholder="e.g. 200"
              disabled={loading}
              style={{ ...inputStyle }}
            />
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{ color: '#f38ba8', background: '#f38ba822', border: '1px solid #f38ba844', borderRadius: 6, padding: '10px 12px', fontSize: 12, marginBottom: 14, whiteSpace: 'pre-wrap' }}>
            {error}
          </div>
        )}

        {/* Run button */}
        <button
          type="button"
          onClick={() => void runBacktest()}
          disabled={loading || !file}
          style={{
            width: '100%', padding: '10px 20px', fontSize: 14, fontWeight: 'bold',
            borderRadius: 6, border: '1px solid #89b4fa',
            background: loading ? '#313244' : '#89b4fa33',
            color: loading ? '#7f849c' : '#89b4fa',
            cursor: loading || !file ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? `Running… ${elapsed}s` : 'Run Monte Carlo'}
        </button>

        {loading && (
          <div style={{ color: '#6c7086', fontSize: 11, textAlign: 'center', marginTop: 10 }}>
            The Rust simulator is running {sessions || (preset === 'heavy' ? '1000' : '100')} sessions in parallel. This may take a minute or two.
          </div>
        )}

        {/* Divider + JSON upload fallback */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '24px 0 12px' }}>
          <div style={{ flex: 1, height: 1, background: '#313244' }} />
          <button
            type="button"
            onClick={() => setShowJsonUpload((v) => !v)}
            style={{ background: 'transparent', border: 'none', color: '#7f849c', cursor: 'pointer', fontSize: 11 }}
          >
            {showJsonUpload ? 'hide' : 'or upload an existing dashboard.json'}
          </button>
          <div style={{ flex: 1, height: 1, background: '#313244' }} />
        </div>

        {showJsonUpload && (
          <>
            <div
              onDragOver={(e) => { e.preventDefault(); setJsonDragOver(true); }}
              onDragLeave={() => setJsonDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setJsonDragOver(false); const f = e.dataTransfer.files[0]; if (f) void processJsonFile(f); }}
              onClick={() => jsonInputRef.current?.click()}
              style={{
                border: `2px dashed ${jsonDragOver ? '#89b4fa' : '#45475a'}`,
                borderRadius: 8, padding: '20px', textAlign: 'center', cursor: 'pointer',
                background: jsonDragOver ? '#89b4fa11' : '#181825',
                transition: 'border-color 0.15s, background 0.15s',
              }}
            >
              <div style={{ color: '#cdd6f4', fontSize: 13, marginBottom: 4 }}>Drop dashboard.json here</div>
              <div style={{ color: '#7f849c', fontSize: 11 }}>or click to select</div>
              <input ref={jsonInputRef} type="file" accept=".json,application/json" style={{ display: 'none' }}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void processJsonFile(f); }} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function MonteCarloPage() {
  const [db, setDb] = useState<MCDashboard | null>(null);

  if (!db) {
    return (
      <div style={{ height: '100%', background: '#11111b' }}>
        <RunForm onLoad={setDb} />
      </div>
    );
  }

  const algName = db.meta.algorithmPath.split(/[\\/]/).pop() ?? db.meta.algorithmPath;
  const totalPnl = db.overall.totalPnl;
  const emeraldPnl = db.overall.emeraldPnl;
  const tomatoPnl = db.overall.tomatoPnl;

  const pillStyle: React.CSSProperties = { background: '#31324488', border: '1px solid #45475a', borderRadius: 4, padding: '2px 8px', fontSize: 10, color: '#a6adc8' };

  return (
    <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10, background: '#11111b', minHeight: '100%' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ color: '#89b4fa', fontSize: 14, fontWeight: 'bold' }}>Monte Carlo Dashboard</span>
        <span style={pillStyle}>📄 {algName}</span>
        <span style={pillStyle}>🎲 {db.meta.sessionCount} sessions</span>
        {db.meta.fvMode && <span style={pillStyle}>FV: {db.meta.fvMode}</span>}
        {db.meta.tradeMode && <span style={pillStyle}>trades: {db.meta.tradeMode}</span>}
        {db.meta.tomatoSupport && <span style={pillStyle}>tomato: {db.meta.tomatoSupport}</span>}
        {db.meta.seed != null && <span style={pillStyle}>seed: {db.meta.seed}</span>}
        <button
          onClick={() => setDb(null)}
          style={{ marginLeft: 'auto', background: 'transparent', border: '1px solid #45475a', borderRadius: 4, color: '#7f849c', cursor: 'pointer', fontSize: 10, padding: '2px 8px' }}
        >
          ✕ Load new
        </button>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <StatCard
          label="Total PnL (mean)"
          value={`${totalPnl.mean >= 0 ? '+' : ''}${fmt(totalPnl.mean)}`}
          sub={`±${fmt(totalPnl.std)}  CI [${fmt(totalPnl.meanConfidenceLow95)}, ${fmt(totalPnl.meanConfidenceHigh95)}]`}
          color={signColor(totalPnl.mean)}
        />
        <StatCard
          label="EMERALDS PnL"
          value={`${emeraldPnl.mean >= 0 ? '+' : ''}${fmt(emeraldPnl.mean)}`}
          sub={`±${fmt(emeraldPnl.std)}`}
          color={EMERALD_COLOR}
        />
        <StatCard
          label="TOMATOES PnL"
          value={`${tomatoPnl.mean >= 0 ? '+' : ''}${fmt(tomatoPnl.mean)}`}
          sub={`±${fmt(tomatoPnl.std)}`}
          color={TOMATO_COLOR}
        />
        <StatCard
          label="Sharpe-like"
          value={totalPnl.sharpeLike.toFixed(3)}
          sub={`Sortino: ${totalPnl.sortinoLike.toFixed(3)}`}
          color={signColor(totalPnl.sharpeLike)}
        />
        <StatCard
          label="Win Rate"
          value={pctFmt(totalPnl.positiveRate)}
          sub={`lose ${pctFmt(totalPnl.negativeRate)} · zero ${pctFmt(totalPnl.zeroRate)}`}
          color={totalPnl.positiveRate > 0.5 ? '#a6e3a1' : '#f38ba8'}
        />
      </div>

      {/* PnL histograms */}
      <div style={{ display: 'flex', gap: 8 }}>
        <DistHistogram title="Total PnL" histKey="totalPnl" db={db} color={TOTAL_COLOR} />
        <DistHistogram title="EMERALDS PnL" histKey="emeraldPnl" db={db} color={EMERALD_COLOR} />
        <DistHistogram title="TOMATOES PnL" histKey="tomatoPnl" db={db} color={TOMATO_COLOR} />
      </div>

      {/* Quantile band chart */}
      {db.bandSeries && Object.keys(db.bandSeries).length > 0 && <BandChart db={db} />}

      {/* Risk metrics table */}
      <RiskTable db={db} />

      {/* Scatter */}
      <ScatterPlot db={db} />

      {/* Session table */}
      <SessionTable db={db} />

      {/* Profitability + Stability charts */}
      <ProfitabilityCharts db={db} />
    </div>
  );
}
