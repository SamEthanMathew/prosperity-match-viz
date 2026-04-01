import { useMemo } from 'react';
import { PlotlyWrapper } from '../shared/PlotlyWrapper';
import { useReplayStore } from '../../store/useReplayStore';
import { PRODUCT_COLORS } from '../../types/data';

const PLOT_BG = '#1e1e2e';
const PAPER_BG = '#181825';
const TEXT_COLOR = '#cdd6f4';
const GRID_COLOR = '#313244';

export function BookPressureTab() {
  const botStates = useReplayStore((s) => s.botStates);
  const bookRows = useReplayStore((s) => s.bookRows);
  const activeTimestamp = useReplayStore((s) => s.activeTimestamp);
  const { setActiveTimestamp } = useReplayStore();

  const products = useMemo(() => [...new Set(botStates.map((b) => b.product))], [botStates]);

  // Imbalance over time per product
  const imbalanceData = useMemo(() => {
    const traces: object[] = [];
    for (const product of products) {
      const productStates = botStates
        .filter((b) => b.product === product)
        .sort((a, b) => a.timestamp - b.timestamp);

      traces.push({
        type: 'scatter',
        mode: 'lines',
        x: productStates.map((b) => b.timestamp),
        y: productStates.map((b) => b.imbalance),
        name: product,
        line: { color: PRODUCT_COLORS[product] ?? '#888', width: 1.2 },
        fill: 'tozeroy',
        fillcolor: (PRODUCT_COLORS[product] ?? '#888') + '33',
        hovertemplate: 'ts=%{x}<br>I=%{y:.3f}<extra>' + product + '</extra>',
      });
    }
    return traces;
  }, [botStates, products]);

  // TOMATOES: EWMA vs mid
  const ewmaVsMidData = useMemo(() => {
    const tomatoStates = botStates
      .filter((b) => b.product === 'TOMATOES' && b.ewma !== undefined)
      .sort((a, b) => a.timestamp - b.timestamp);
    if (tomatoStates.length === 0) return [];

    return [
      {
        type: 'scatter', mode: 'lines',
        x: tomatoStates.map((b) => b.timestamp),
        y: tomatoStates.map((b) => b.mid),
        name: 'Mid', line: { color: '#cdd6f4', width: 1.2 },
        hovertemplate: 'ts=%{x}<br>mid=%{y:.2f}<extra>Mid</extra>',
      },
      {
        type: 'scatter', mode: 'lines',
        x: tomatoStates.map((b) => b.timestamp),
        y: tomatoStates.map((b) => b.ewma),
        name: 'EWMA', line: { color: '#cba6f7', width: 1.2, dash: 'dash' },
        hovertemplate: 'ts=%{x}<br>ewma=%{y:.2f}<extra>EWMA</extra>',
      },
      {
        type: 'scatter', mode: 'lines',
        x: tomatoStates.map((b) => b.timestamp),
        y: tomatoStates.map((b) => (b.mid ?? 0) - (b.ewma ?? b.mid ?? 0)),
        name: 'mid-EWMA', line: { color: '#fab387', width: 1, dash: 'dot' },
        yaxis: 'y2',
        hovertemplate: 'ts=%{x}<br>dev=%{y:.2f}<extra>Deviation</extra>',
      },
    ];
  }, [botStates]);

  // Imbalance vs next-tick price change scatter
  const imbalanceVsPriceChange = useMemo(() => {
    const traces: object[] = [];
    for (const product of products) {
      const productRows = bookRows
        .filter((r) => r.product === product)
        .sort((a, b) => a.timestamp - b.timestamp);

      // Build ts → index map
      const tsMap = new Map<number, number>();
      productRows.forEach((r, i) => tsMap.set(r.timestamp, i));

      const productStates = botStates
        .filter((b) => b.product === product)
        .sort((a, b) => a.timestamp - b.timestamp);

      const xs: number[] = [];
      const ys: number[] = [];
      const colors: string[] = [];

      for (const bs of productStates) {
        const idx = tsMap.get(bs.timestamp);
        if (idx === undefined || idx + 1 >= productRows.length) continue;
        const nextRow = productRows[idx + 1];
        const curRow = productRows[idx];
        const dMid = nextRow.midPrice - curRow.midPrice;
        xs.push(bs.imbalance);
        ys.push(dMid);
        colors.push(bs.imbalance > 0 ? PRODUCT_COLORS[product] ?? '#888' : '#f38ba8');
      }

      traces.push({
        type: 'scatter',
        mode: 'markers',
        x: xs,
        y: ys,
        name: product,
        marker: { color: colors, size: 4, opacity: 0.5 },
        hovertemplate: 'I=%{x:.3f}<br>dMid=%{y:.2f}<extra>' + product + '</extra>',
      });
    }
    return traces;
  }, [botStates, bookRows, products]);

  const handleClick = (event: { points: Array<{ x?: unknown }> }) => {
    const pt = event.points[0];
    if (pt?.x !== undefined) {
      const x = pt.x as number;
      if (x > 1000) setActiveTimestamp(Math.round(x));
    }
  };

  const imbalanceLayout = useMemo(() => ({
    xaxis: { title: 'Timestamp (ms)', color: TEXT_COLOR, gridcolor: GRID_COLOR },
    yaxis: { title: 'Imbalance (I)', color: TEXT_COLOR, gridcolor: GRID_COLOR, zeroline: true, zerolinecolor: '#45475a' },
    shapes: [{
      type: 'line', x0: activeTimestamp, x1: activeTimestamp,
      y0: 0, y1: 1, yref: 'paper',
      line: { color: 'rgba(249,226,175,0.8)', width: 1.5, dash: 'dot' },
    }],
    margin: { t: 20, r: 10, b: 40, l: 60 },
    plot_bgcolor: PLOT_BG, paper_bgcolor: PAPER_BG,
    font: { color: TEXT_COLOR, size: 11 },
    hovermode: 'x unified',
    legend: { orientation: 'h', y: -0.2 },
  }), [activeTimestamp]);

  const ewmaLayout = useMemo(() => ({
    xaxis: { title: 'Timestamp (ms)', color: TEXT_COLOR, gridcolor: GRID_COLOR },
    yaxis: { title: 'Price', color: TEXT_COLOR, gridcolor: GRID_COLOR, domain: [0.3, 1.0] },
    yaxis2: { title: 'Deviation', color: '#fab387', gridcolor: GRID_COLOR, domain: [0, 0.27], zeroline: true, zerolinecolor: '#45475a' },
    shapes: [{
      type: 'line', x0: activeTimestamp, x1: activeTimestamp,
      y0: 0, y1: 1, yref: 'paper',
      line: { color: 'rgba(249,226,175,0.8)', width: 1.5, dash: 'dot' },
    }],
    margin: { t: 20, r: 10, b: 40, l: 60 },
    plot_bgcolor: PLOT_BG, paper_bgcolor: PAPER_BG,
    font: { color: TEXT_COLOR, size: 11 },
    hovermode: 'x unified',
    legend: { orientation: 'h', y: -0.2 },
  }), [activeTimestamp]);

  const signalScatterLayout = {
    xaxis: { title: 'Imbalance (I)', color: TEXT_COLOR, gridcolor: GRID_COLOR, zeroline: true, zerolinecolor: '#45475a' },
    yaxis: { title: 'Next-tick dMid', color: TEXT_COLOR, gridcolor: GRID_COLOR, zeroline: true, zerolinecolor: '#45475a' },
    margin: { t: 20, r: 10, b: 50, l: 60 },
    plot_bgcolor: PLOT_BG, paper_bgcolor: PAPER_BG,
    font: { color: TEXT_COLOR, size: 11 },
    hovermode: 'closest',
    legend: { orientation: 'h', y: -0.2 },
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'auto', padding: 8, gap: 8 }}>
      <div style={{ color: '#89b4fa', fontSize: 13, fontWeight: 'bold' }}>Book Pressure / Signal Diagnostics</div>

      {/* Imbalance timeline */}
      <div style={{ background: '#181825', border: '1px solid #313244', borderRadius: 6, overflow: 'hidden', height: 220 }}>
        <div style={{ color: '#7f849c', fontSize: 10, padding: '4px 8px' }}>Imbalance (I) over time — positive = bid-heavy, negative = ask-heavy</div>
        <PlotlyWrapper
          data={imbalanceData}
          layout={imbalanceLayout}
          onClick={handleClick}
          style={{ width: '100%', height: 190 }}
        />
      </div>

      {/* EWMA vs mid (TOMATOES) */}
      {ewmaVsMidData.length > 0 && (
        <div style={{ background: '#181825', border: '1px solid #313244', borderRadius: 6, overflow: 'hidden', height: 250 }}>
          <div style={{ color: '#7f849c', fontSize: 10, padding: '4px 8px' }}>TOMATOES: Mid vs EWMA Fair (deviation = MR signal)</div>
          <PlotlyWrapper
            data={ewmaVsMidData}
            layout={ewmaLayout}
            onClick={handleClick}
            style={{ width: '100%', height: 220 }}
          />
        </div>
      )}

      {/* Imbalance vs price change scatter */}
      <div style={{ background: '#181825', border: '1px solid #313244', borderRadius: 6, overflow: 'hidden', height: 260 }}>
        <div style={{ color: '#7f849c', fontSize: 10, padding: '4px 8px' }}>Imbalance predictive power: I vs next-tick dMid</div>
        <PlotlyWrapper
          data={imbalanceVsPriceChange}
          layout={signalScatterLayout}
          style={{ width: '100%', height: 230 }}
        />
      </div>
    </div>
  );
}
