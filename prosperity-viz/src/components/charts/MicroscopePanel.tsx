import { useMemo } from 'react';
import { useReplayStore } from '../../store/useReplayStore';
import { PlotlyWrapper } from '../shared/PlotlyWrapper';
import { BookDepthBar } from '../shared/BookDepthBar';
import { bisectRight } from '../../utils/arrayUtils';
import { fmtNum, fmtPnl } from '../../utils/formatters';
import { MODE_COLORS, PRODUCTS } from '../../types/data';

const PLOT_BG = '#1e1e2e';
const PAPER_BG = '#181825';
const TEXT_COLOR = '#cdd6f4';
const GRID_COLOR = '#313244';

function ModeTag({ mode }: { mode: string }) {
  const color = MODE_COLORS[mode as keyof typeof MODE_COLORS] ?? '#585b70';
  return (
    <span
      style={{
        background: color,
        color: '#1e1e2e',
        padding: '1px 6px',
        borderRadius: 3,
        fontSize: 11,
        fontWeight: 'bold',
      }}
    >
      {mode}
    </span>
  );
}

function KVRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1px 0', borderBottom: '1px solid #313244' }}>
      <span style={{ color: '#7f849c', fontSize: 11 }}>{label}</span>
      <span style={{ color: color ?? '#cdd6f4', fontSize: 11, fontFamily: 'monospace' }}>{value}</span>
    </div>
  );
}

function ProductMicroscope({ product }: { product: string }) {
  const masterFrames = useReplayStore((s) => s.masterFrames);
  const tradeOutcomes = useReplayStore((s) => s.tradeOutcomes);
  const activeTimestamp = useReplayStore((s) => s.activeTimestamp);

  // Find frame at or nearest to activeTimestamp for this product
  const frame = useMemo(() => {
    const productFrames = masterFrames
      .filter((f) => f.product === product)
      .sort((a, b) => a.timestamp - b.timestamp);
    const idx = bisectRight(productFrames, activeTimestamp, (f) => f.timestamp);
    return productFrames[Math.max(0, Math.min(idx, productFrames.length - 1))] ?? null;
  }, [masterFrames, activeTimestamp, product]);

  // Trades at or near this timestamp
  const nearbyOutcomes = useMemo(() => {
    return tradeOutcomes.filter(
      (o) =>
        o.trade.symbol === product &&
        Math.abs(o.trade.timestamp - activeTimestamp) <= 100,
    );
  }, [tradeOutcomes, activeTimestamp, product]);

  if (!frame) return null;

  const bs = frame.botState;
  const book = frame.book;
  const invColor =
    bs && bs.inv > 0 ? '#a6e3a1' : bs && bs.inv < 0 ? '#f38ba8' : '#cdd6f4';
  const capPct = bs ? Math.abs(bs.inv) / bs.cap : 0;

  return (
    <div style={{ padding: '6px 8px', borderRight: '1px solid #313244', flex: 1, minWidth: 0, overflow: 'auto' }}>
      <div style={{ color: '#89b4fa', fontSize: 11, fontWeight: 'bold', marginBottom: 4 }}>
        {product}
        <span style={{ color: '#6c7086', fontSize: 10, marginLeft: 8 }}>
          ts={frame.timestamp}
        </span>
      </div>

      {/* Book depth */}
      <div style={{ marginBottom: 8 }}>
        <BookDepthBar book={book} fair={bs?.fair} />
      </div>

      {/* Bot state */}
      {bs ? (
        <div style={{ marginBottom: 8 }}>
          <div style={{ color: '#7f849c', fontSize: 10, marginBottom: 3 }}>BOT STATE</div>
          <KVRow label="mode" value="" />
          <div style={{ textAlign: 'right', padding: '1px 0', borderBottom: '1px solid #313244', marginBottom: 2 }}>
            <ModeTag mode={bs.mode} />
          </div>
          <KVRow
            label="inv / cap"
            value={`${bs.inv} / ${bs.cap} (${(capPct * 100).toFixed(0)}%)`}
            color={invColor}
          />
          <div style={{ background: '#313244', height: 4, borderRadius: 2, margin: '3px 0 5px' }}>
            <div
              style={{
                width: `${Math.min(capPct * 100, 100)}%`,
                height: '100%',
                background: capPct >= 0.85 ? '#f38ba8' : '#89b4fa',
                borderRadius: 2,
              }}
            />
          </div>
          <KVRow label="fair" value={fmtNum(bs.fair, 2)} color="#f9e2af" />
          <KVRow label="mid" value={fmtNum(bs.mid, 2)} />
          <KVRow
            label="imbalance"
            value={fmtNum(bs.imbalance, 3)}
            color={bs.imbalance > 0 ? '#a6e3a1' : bs.imbalance < 0 ? '#f38ba8' : '#cdd6f4'}
          />
          {bs.skew !== undefined && <KVRow label="skew" value={String(bs.skew)} />}
          {bs.ewma !== undefined && <KVRow label="ewma" value={fmtNum(bs.ewma, 2)} color="#cba6f7" />}
          {bs.dMid !== undefined && (
            <KVRow
              label="dMid"
              value={fmtNum(bs.dMid, 2)}
              color={bs.dMid > 0 ? '#a6e3a1' : bs.dMid < 0 ? '#f38ba8' : '#cdd6f4'}
            />
          )}
          <KVRow label="n_orders" value={String(bs.nOrders)} />
        </div>
      ) : (
        <div style={{ color: '#6c7086', fontSize: 10, marginBottom: 8 }}>
          (no bot state at this tick)
        </div>
      )}

      {/* Trade outcomes at this tick */}
      {nearbyOutcomes.length > 0 && (
        <div>
          <div style={{ color: '#7f849c', fontSize: 10, marginBottom: 3 }}>FILLS @ THIS TICK</div>
          {nearbyOutcomes.map((o, i) => {
            const t = o.trade;
            return (
              <div
                key={i}
                style={{
                  border: `1px solid ${t.isBuy ? '#a6e3a1' : '#f38ba8'}33`,
                  borderRadius: 4,
                  padding: '4px 6px',
                  marginBottom: 4,
                  fontSize: 11,
                }}
              >
                <div style={{ color: t.isBuy ? '#a6e3a1' : '#f38ba8', fontWeight: 'bold' }}>
                  {t.isBuy ? '▲ BUY' : '▼ SELL'} {t.quantity} @ {t.price}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, marginTop: 3 }}>
                  <span style={{ color: '#6c7086' }}>spread@fill</span>
                  <span style={{ fontFamily: 'monospace', color: '#cdd6f4' }}>{fmtNum(o.spreadAtFill, 1)}</span>
                  <span style={{ color: '#6c7086' }}>+100ms</span>
                  <span style={{ fontFamily: 'monospace', color: fwdColor(o.fwd100) }}>
                    {fmtPnl(o.fwd100)}
                  </span>
                  <span style={{ color: '#6c7086' }}>+500ms</span>
                  <span style={{ fontFamily: 'monospace', color: fwdColor(o.fwd500) }}>
                    {fmtPnl(o.fwd500)}
                  </span>
                  <span style={{ color: '#6c7086' }}>+1s</span>
                  <span style={{ fontFamily: 'monospace', color: fwdColor(o.fwd1000) }}>
                    {fmtPnl(o.fwd1000)}
                  </span>
                  <span style={{ color: '#6c7086' }}>+5s</span>
                  <span style={{ fontFamily: 'monospace', color: fwdColor(o.fwd5000) }}>
                    {fmtPnl(o.fwd5000)}
                  </span>
                  <span style={{ color: '#6c7086' }}>adv.sel(500)</span>
                  <span
                    style={{
                      fontFamily: 'monospace',
                      color:
                        o.adverseSelection500 !== null && o.adverseSelection500 > 0
                          ? '#f38ba8'
                          : '#a6e3a1',
                    }}
                  >
                    {fmtPnl(o.adverseSelection500)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function fwdColor(val: number | null): string {
  if (val === null) return '#6c7086';
  if (val > 0) return '#a6e3a1';
  if (val < 0) return '#f38ba8';
  return '#cdd6f4';
}

export function MicroscopePanel() {
  const bookRows = useReplayStore((s) => s.bookRows);
  const botStates = useReplayStore((s) => s.botStates);
  const trades = useReplayStore((s) => s.trades);
  const activeTimestamp = useReplayStore((s) => s.activeTimestamp);
  const activeProduct = useReplayStore((s) => s.activeProduct);
  const chartScale = useReplayStore((s) => s.chartScales['microscope']);

  // Mini-chart: ±3000ms window around activeTimestamp for active product
  const WINDOW = 3000;
  const miniData = useMemo(() => {
    const lo = activeTimestamp - WINDOW;
    const hi = activeTimestamp + WINDOW;
    const rows = bookRows
      .filter((r) => r.product === activeProduct && r.timestamp >= lo && r.timestamp <= hi)
      .sort((a, b) => a.timestamp - b.timestamp);
    const states = botStates
      .filter((b) => b.product === activeProduct && b.timestamp >= lo && b.timestamp <= hi)
      .sort((a, b) => a.timestamp - b.timestamp);
    const fills = trades.filter(
      (t) => t.symbol === activeProduct && t.timestamp >= lo && t.timestamp <= hi,
    );
    return { rows, states, fills };
  }, [bookRows, botStates, trades, activeTimestamp, activeProduct, WINDOW]);

  const miniChartData = useMemo(() => {
    const traces: object[] = [];
    if (miniData.rows.length === 0) return traces;

    traces.push({
      type: 'scatter', mode: 'lines',
      x: miniData.rows.map((r) => r.timestamp),
      y: miniData.rows.map((r) => r.midPrice),
      name: 'Mid', line: { color: '#cdd6f4', width: 1.5 },
    });

    if (miniData.states.length > 0) {
      traces.push({
        type: 'scatter', mode: 'lines',
        x: miniData.states.map((b) => b.timestamp),
        y: miniData.states.map((b) => b.fair),
        name: 'Fair', line: { color: '#f9e2af', width: 1, dash: 'dash' },
      });
    }

    const buys = miniData.fills.filter((t) => t.isBuy);
    const sells = miniData.fills.filter((t) => !t.isBuy);

    if (buys.length > 0) {
      traces.push({
        type: 'scatter', mode: 'markers',
        x: buys.map((t) => t.timestamp),
        y: buys.map((t) => t.price),
        name: 'Buy', marker: { symbol: 'triangle-up', size: 9, color: '#a6e3a1' },
      });
    }
    if (sells.length > 0) {
      traces.push({
        type: 'scatter', mode: 'markers',
        x: sells.map((t) => t.timestamp),
        y: sells.map((t) => t.price),
        name: 'Sell', marker: { symbol: 'triangle-down', size: 9, color: '#f38ba8' },
      });
    }

    return traces;
  }, [miniData]);

  const miniLayout = useMemo(() => ({
    xaxis: {
      range: [activeTimestamp - WINDOW, activeTimestamp + WINDOW],
      color: TEXT_COLOR, gridcolor: GRID_COLOR, type: 'linear',
    },
    yaxis: {
      color: TEXT_COLOR,
      gridcolor: GRID_COLOR,
      ...(chartScale ? { scaleanchor: 'x', scaleratio: chartScale.y / chartScale.x } : {}),
    },
    shapes: [{
      type: 'line',
      x0: activeTimestamp, x1: activeTimestamp,
      y0: 0, y1: 1, yref: 'paper',
      line: { color: 'rgba(249,226,175,0.9)', width: 2, dash: 'dot' },
    }],
    margin: { t: 10, r: 10, b: 30, l: 50 },
    plot_bgcolor: PLOT_BG,
    paper_bgcolor: PAPER_BG,
    font: { color: TEXT_COLOR, size: 10 },
    showlegend: false,
    hovermode: 'x unified',
  }), [activeTimestamp, chartScale]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Per-product cards */}
      <div style={{ display: 'flex', flex: 1, overflow: 'auto', minHeight: 0 }}>
        {PRODUCTS.map((p) => (
          <ProductMicroscope key={p} product={p} />
        ))}
      </div>

      {/* Mini-chart */}
      <div style={{ height: 120, borderTop: '1px solid #313244', flexShrink: 0 }}>
        <div style={{ color: '#6c7086', fontSize: 10, padding: '2px 8px' }}>
          {activeProduct} ±3s window
        </div>
        <PlotlyWrapper
          data={miniChartData}
          layout={miniLayout}
          config={{ displayModeBar: false }}
          style={{ width: '100%', height: 100 }}
        />
      </div>
    </div>
  );
}
