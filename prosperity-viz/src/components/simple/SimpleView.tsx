import { useMemo } from 'react';
import { useReplayStore } from '../../store/useReplayStore';
import { PlotlyWrapper } from '../shared/PlotlyWrapper';
import { bisectRight } from '../../utils/arrayUtils';
import { CAP_MAP, PRODUCT_COLORS } from '../../types/data';
import type { BotState, Trade, TradeOutcome, Bookmark } from '../../types/data';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fairAtFill(trade: Trade, botStates: BotState[]): number | null {
  const productStates = botStates
    .filter((b) => b.product === trade.symbol)
    .sort((a, b) => a.timestamp - b.timestamp);
  if (productStates.length === 0) return null;
  const idx = bisectRight(productStates, trade.timestamp, (b) => b.timestamp);
  return productStates[Math.max(0, Math.min(idx, productStates.length - 1))].fair;
}

function tradeEdge(trade: Trade, fair: number): number {
  if (trade.submissionSide === 'buy') return fair - trade.price;
  if (trade.submissionSide === 'sell') return trade.price - fair;
  return 0;
}

const MODE_PLAIN: Record<string, string> = {
  passive: 'Waiting — posting limit orders, letting others come to us',
  taker_imb: 'Acting fast — more buyers/sellers than usual, seizing the opportunity',
  taker_mr_buy: 'Buying aggressively — price dropped well below fair value',
  taker_mr_sell: 'Selling aggressively — price rose well above fair value',
  skip: 'Paused — near position limit or no clear edge',
};

const MODE_EMOJI: Record<string, string> = {
  passive: '⏸️',
  taker_imb: '⚡',
  taker_mr_buy: '🟢',
  taker_mr_sell: '🔴',
  skip: '🛑',
};

const PLOT_BG = '#1e1e2e';
const PAPER_BG = '#181825';
const TEXT_COLOR = '#cdd6f4';
const GRID_COLOR = '#313244';

// ── Section 1: Score Cards ────────────────────────────────────────────────────

function ScoreCards() {
  const meta = useReplayStore((s) => s.meta);
  const trades = useReplayStore((s) => s.trades);
  const equityPoints = useReplayStore((s) => s.equityPoints);

  if (!meta) return null;

  const ownTrades = trades.filter((t) => t.submissionSide !== null);
  const tradeCounts: Record<string, number> = {};
  for (const t of ownTrades) {
    tradeCounts[t.symbol] = (tradeCounts[t.symbol] ?? 0) + 1;
  }

  const duration = equityPoints.length > 0
    ? equityPoints[equityPoints.length - 1].timestamp / 1000
    : 0;

  const finalPositions = meta.positions.filter((p) => p.symbol !== 'XIRECS');

  const cardStyle: React.CSSProperties = {
    background: '#181825',
    border: '1px solid #313244',
    borderRadius: 10,
    padding: '16px 20px',
    minWidth: 160,
    flex: '1 1 160px',
  };

  return (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
      {/* Profit */}
      <div style={{ ...cardStyle, borderColor: '#a6e3a144' }}>
        <div style={{ fontSize: 11, color: '#7f849c', marginBottom: 4 }}>💰 Total Profit</div>
        <div style={{ fontSize: 28, fontWeight: 'bold', color: meta.profit >= 0 ? '#a6e3a1' : '#f38ba8', fontFamily: 'monospace' }}>
          {meta.profit >= 0 ? '+' : ''}{meta.profit.toFixed(2)}
        </div>
        <div style={{ fontSize: 10, color: '#6c7086', marginTop: 4 }}>cash</div>
      </div>

      {/* Trades */}
      <div style={cardStyle}>
        <div style={{ fontSize: 11, color: '#7f849c', marginBottom: 4 }}>📊 Your fills</div>
        <div style={{ fontSize: 28, fontWeight: 'bold', color: '#89b4fa', fontFamily: 'monospace' }}>
          {ownTrades.length}
        </div>
        <div style={{ marginTop: 4 }}>
          {Object.entries(tradeCounts).map(([sym, cnt]) => (
            <div key={sym} style={{ fontSize: 10, color: PRODUCT_COLORS[sym] ?? '#cdd6f4' }}>
              {sym}: {cnt}
            </div>
          ))}
        </div>
      </div>

      {/* Duration */}
      <div style={cardStyle}>
        <div style={{ fontSize: 11, color: '#7f849c', marginBottom: 4 }}>⏱ Duration</div>
        <div style={{ fontSize: 28, fontWeight: 'bold', color: '#89dceb', fontFamily: 'monospace' }}>
          {duration.toFixed(0)}s
        </div>
        <div style={{ fontSize: 10, color: '#6c7086', marginTop: 4 }}>
          ~{(ownTrades.length / Math.max(duration, 1e-6)).toFixed(1)} fills/sec
        </div>
      </div>

      {/* Final inventory */}
      <div style={{ ...cardStyle, borderColor: finalPositions.some((p) => Math.abs(p.quantity) > 0 && p.symbol !== 'XIRECS') ? '#fab38744' : '#313244' }}>
        <div style={{ fontSize: 11, color: '#7f849c', marginBottom: 4 }}>📦 Final Inventory</div>
        {finalPositions.map((pos) => {
          const cap = CAP_MAP[pos.symbol] ?? 30;
          const pct = Math.abs(pos.quantity) / cap;
          const isWarning = pct > 0.3;
          return (
            <div key={pos.symbol} style={{ marginBottom: 4 }}>
              <div style={{ fontSize: 13, fontWeight: 'bold', color: isWarning ? '#fab387' : '#cdd6f4', fontFamily: 'monospace' }}>
                {pos.quantity >= 0 ? '+' : ''}{pos.quantity} {pos.symbol} {isWarning ? '⚠️' : ''}
              </div>
              {isWarning && (
                <div style={{ fontSize: 9, color: '#fab387' }}>
                  {(pct * 100).toFixed(0)}% of cap — not flat!
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Section 2: Real Value vs Market Price chart ───────────────────────────────

function FairValueChart({ product }: { product: string }) {
  const bookRows = useReplayStore((s) => s.bookRows);
  const botStates = useReplayStore((s) => s.botStates);
  const trades = useReplayStore((s) => s.trades);

  const { data, layout } = useMemo(() => {
    const productRows = bookRows
      .filter((r) => r.product === product)
      .sort((a, b) => a.timestamp - b.timestamp);

    const productStates = botStates
      .filter((b) => b.product === product)
      .sort((a, b) => a.timestamp - b.timestamp);

    const productTrades = trades.filter((t) => t.symbol === product);
    const ownProductTrades = productTrades.filter((t) => t.submissionSide !== null);

    // Build carry-forward fair value aligned to bookRows timestamps
    const fairByTs = new Map<number, number>();
    let lastFair: number | null = null;
    let stateIdx = 0;
    for (const row of productRows) {
      while (stateIdx < productStates.length && productStates[stateIdx].timestamp <= row.timestamp) {
        lastFair = productStates[stateIdx].fair;
        stateIdx++;
      }
      if (lastFair !== null) fairByTs.set(row.timestamp, lastFair);
    }

    const rows = productRows.filter((r) => fairByTs.has(r.timestamp));
    const ts = rows.map((r) => r.timestamp);
    const midPrices = rows.map((r) => r.midPrice);
    const fairPrices = rows.map((r) => fairByTs.get(r.timestamp)!);

    // Deviation = fair - mid
    // positive = market is CHEAP (green)
    // negative = market is EXPENSIVE (red)
    const deviationPos = rows.map((r) => {
      const fair = fairByTs.get(r.timestamp)!;
      const dev = fair - r.midPrice;
      return dev > 0 ? dev : null;
    });
    const deviationNeg = rows.map((r) => {
      const fair = fairByTs.get(r.timestamp)!;
      const dev = fair - r.midPrice;
      return dev < 0 ? dev : null;
    });

    const buys = ownProductTrades.filter((t) => t.submissionSide === 'buy');
    const sells = ownProductTrades.filter((t) => t.submissionSide === 'sell');

    const traces: object[] = [
      // Mid price (grey)
      {
        type: 'scatter', mode: 'lines',
        x: ts, y: midPrices,
        name: 'Market Price',
        line: { color: '#9399b2', width: 2 },
        hovertemplate: 'ts=%{x}<br>market=%{y:.2f}<extra>Market Price</extra>',
      },
      // Fair value (yellow dashed)
      {
        type: 'scatter', mode: 'lines',
        x: ts, y: fairPrices,
        name: 'Fair Value (real worth)',
        line: { color: '#f9e2af', width: 2, dash: 'dash' },
        hovertemplate: 'ts=%{x}<br>fair=%{y:.2f}<extra>Fair Value</extra>',
      },
      // Cheap region (green fill — fair > mid, market undervalued → good to BUY)
      {
        type: 'scatter', mode: 'none',
        x: ts, y: fairPrices.map((f, i) => f > midPrices[i] ? f : midPrices[i]),
        fill: 'none', showlegend: false, hoverinfo: 'skip',
      },
      {
        type: 'scatter', mode: 'none',
        x: ts, y: fairPrices.map((f, i) => f > midPrices[i] ? midPrices[i] : f),
        fill: 'tonexty', fillcolor: 'rgba(166,227,161,0.20)',
        name: 'Cheap — good to BUY',
        showlegend: deviationPos.some((v) => v !== null),
        hoverinfo: 'skip',
        line: { color: 'transparent' },
      },
      // Expensive region (red fill — fair < mid, market overvalued → good to SELL)
      {
        type: 'scatter', mode: 'none',
        x: ts, y: fairPrices.map((f, i) => f < midPrices[i] ? f : midPrices[i]),
        fill: 'none', showlegend: false, hoverinfo: 'skip',
      },
      {
        type: 'scatter', mode: 'none',
        x: ts, y: fairPrices.map((f, i) => f < midPrices[i] ? midPrices[i] : f),
        fill: 'tonexty', fillcolor: 'rgba(243,139,168,0.20)',
        name: 'Expensive — good to SELL',
        showlegend: deviationNeg.some((v) => v !== null),
        hoverinfo: 'skip',
        line: { color: 'transparent' },
      },
      // Buy fills
      ...(buys.length > 0 ? [{
        type: 'scatter', mode: 'markers',
        x: buys.map((t) => t.timestamp),
        y: buys.map((t) => t.price),
        name: 'Our BUY orders',
        marker: { symbol: 'triangle-up', size: 11, color: '#a6e3a1', line: { color: '#1e1e2e', width: 1 } },
        text: buys.map((t) => {
          const fair = fairAtFill(t, botStates);
          const edge = fair !== null ? (fair - t.price).toFixed(1) : '?';
          return `Bought ${t.quantity} @ ${t.price}<br>Fair was ${fair?.toFixed(1) ?? '?'}<br>Edge: ${edge}`;
        }),
        hovertemplate: '%{text}<extra>Buy</extra>',
      }] : []),
      // Sell fills
      ...(sells.length > 0 ? [{
        type: 'scatter', mode: 'markers',
        x: sells.map((t) => t.timestamp),
        y: sells.map((t) => t.price),
        name: 'Our SELL orders',
        marker: { symbol: 'triangle-down', size: 11, color: '#f38ba8', line: { color: '#1e1e2e', width: 1 } },
        text: sells.map((t) => {
          const fair = fairAtFill(t, botStates);
          const edge = fair !== null ? (t.price - fair).toFixed(1) : '?';
          return `Sold ${t.quantity} @ ${t.price}<br>Fair was ${fair?.toFixed(1) ?? '?'}<br>Edge: ${edge}`;
        }),
        hovertemplate: '%{text}<extra>Sell</extra>',
      }] : []),
    ];

    const layout = {
      xaxis: { title: 'Time (milliseconds)', color: TEXT_COLOR, gridcolor: GRID_COLOR },
      yaxis: { title: 'Price (cash)', color: TEXT_COLOR, gridcolor: GRID_COLOR },
      hovermode: 'closest',
      legend: { orientation: 'h', y: -0.2, font: { color: TEXT_COLOR, size: 10 } },
      margin: { t: 10, r: 10, b: 50, l: 65 },
      plot_bgcolor: PLOT_BG, paper_bgcolor: PAPER_BG,
      font: { color: TEXT_COLOR, size: 11 },
    };

    return { data: traces, layout };
  }, [bookRows, botStates, trades, product]);

  return (
    <PlotlyWrapper
      data={data}
      layout={layout}
      style={{ width: '100%', height: 320 }}
    />
  );
}

// ── Section 3: Trade Quality Dots ─────────────────────────────────────────────

function TradeQualitySection() {
  const trades = useReplayStore((s) => s.trades);
  const botStates = useReplayStore((s) => s.botStates);
  const tradeOutcomes = useReplayStore((s) => s.tradeOutcomes);

  const products = useMemo(() => [...new Set(trades.map((t) => t.symbol))], [trades]);

  // Build edge data per product
  const edgeData = useMemo(() => {
    const outcomeByKey = new Map<string, TradeOutcome>();
    for (const o of tradeOutcomes) {
      outcomeByKey.set(`${o.trade.timestamp}_${o.trade.symbol}_${o.trade.price}`, o);
    }

    return products.map((product) => {
      const productTrades = trades.filter(
        (t) => t.symbol === product && t.submissionSide !== null,
      );
      const points = productTrades.map((t) => {
        const fair = fairAtFill(t, botStates);
        if (fair === null) return null;
        const edge = tradeEdge(t, fair);
        const key = `${t.timestamp}_${t.symbol}_${t.price}`;
        const outcome = outcomeByKey.get(key);
        return { trade: t, edge, fair, fwd500: outcome?.fwd500 ?? null };
      }).filter(Boolean) as { trade: Trade; edge: number; fair: number; fwd500: number | null }[];

      const goodTrades = points.filter((p) => p.edge > 0).length;
      const winRate = points.length > 0 ? goodTrades / points.length : 0;

      return { product, points, goodTrades, winRate };
    });
  }, [trades, botStates, tradeOutcomes, products]);

  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ fontSize: 16, fontWeight: 'bold', color: '#cdd6f4', marginBottom: 6 }}>
        3. Were our trades good?
      </div>
      <div style={{ color: '#7f849c', fontSize: 12, marginBottom: 16, lineHeight: 1.6 }}>
        Each dot below is one trade. Dots on the <span style={{ color: '#a6e3a1', fontWeight: 'bold' }}>right side</span> mean
        we bought below fair value or sold above fair value — that's what you want.
        Dots on the <span style={{ color: '#f38ba8', fontWeight: 'bold' }}>left side</span> mean we traded in the "wrong" direction vs what the asset was really worth.
      </div>

      {edgeData.map(({ product, points, goodTrades, winRate }) => {
        if (points.length === 0) return null;
        const maxEdge = Math.max(...points.map((p) => Math.abs(p.edge)), 1);

        return (
          <div key={product} style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ color: PRODUCT_COLORS[product] ?? '#cdd6f4', fontWeight: 'bold', fontSize: 13 }}>
                {product}
              </span>
              <span style={{ fontSize: 12, color: winRate >= 0.6 ? '#a6e3a1' : winRate >= 0.4 ? '#f9e2af' : '#f38ba8' }}>
                {goodTrades} / {points.length} trades with positive edge ({(winRate * 100).toFixed(0)}%)
              </span>
            </div>

            {/* Dot plot */}
            <div style={{ position: 'relative', height: 80, background: '#181825', borderRadius: 8, border: '1px solid #313244', overflow: 'hidden' }}>
              {/* Zero line */}
              <div style={{
                position: 'absolute', left: '50%', top: 8, bottom: 8,
                width: 1, background: '#45475a',
                transform: 'translateX(-50%)',
              }} />
              {/* Labels */}
              <div style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 9, color: '#6c7086' }}>
                ← traded against edge
              </div>
              <div style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 9, color: '#6c7086' }}>
                traded with edge →
              </div>
              {/* "Fair" label */}
              <div style={{ position: 'absolute', left: '50%', top: 6, transform: 'translateX(-50%)', fontSize: 9, color: '#f9e2af', whiteSpace: 'nowrap' }}>
                ✦ fair value
              </div>

              {/* Dots */}
              {points.map((p, i) => {
                const xPct = 50 + (p.edge / maxEdge) * 45; // 5%-95% range
                const yPct = 30 + (i % 4) * 12; // scatter vertically to avoid overlap
                const isGood = p.edge > 0;
                return (
                  <div
                    key={i}
                    title={`${p.trade.submissionSide === 'buy' ? 'BUY' : 'SELL'} ${p.trade.quantity} @ ${p.trade.price} | fair=${p.fair.toFixed(1)} | edge=${p.edge.toFixed(1)} | fwd500=${p.fwd500?.toFixed(1) ?? '?'}`}
                    style={{
                      position: 'absolute',
                      left: `${xPct}%`,
                      top: `${yPct}%`,
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: isGood ? '#a6e3a1' : '#f38ba8',
                      opacity: 0.8,
                      transform: 'translate(-50%,-50%)',
                      cursor: 'default',
                    }}
                  />
                );
              })}
            </div>

            {/* Win rate bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
              <div style={{ flex: 1, background: '#313244', height: 6, borderRadius: 3 }}>
                <div style={{
                  width: `${winRate * 100}%`,
                  height: '100%',
                  background: winRate >= 0.6 ? '#a6e3a1' : winRate >= 0.4 ? '#f9e2af' : '#f38ba8',
                  borderRadius: 3,
                  transition: 'width 0.3s',
                }} />
              </div>
              <span style={{ fontSize: 10, color: '#7f849c', whiteSpace: 'nowrap' }}>
                {(winRate * 100).toFixed(0)}% good
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Section 4: Plain English Trade Log ───────────────────────────────────────

interface EventCard {
  timestamp: number;
  type: 'fill' | 'mode' | 'milestone' | 'inventory';
  headline: string;
  body: string;
  outcome?: string;
  color: string;
  emoji: string;
}

function buildEventCards(
  bookmarks: Bookmark[],
  trades: Trade[],
  botStates: BotState[],
  tradeOutcomes: TradeOutcome[],
): EventCard[] {
  const outcomeByKey = new Map<string, TradeOutcome>();
  for (const o of tradeOutcomes) {
    outcomeByKey.set(`${o.trade.timestamp}_${o.trade.symbol}_${o.trade.price}`, o);
  }

  const cards: EventCard[] = [];
  const MAX_CARDS = 30;

  for (const bm of bookmarks) {
    if (cards.length >= MAX_CARDS) break;

    if (bm.category === 'large_fill') {
      // Find the trade
      const trade = trades.find(
        (t) =>
          t.timestamp === bm.timestamp &&
          (bm.product === undefined || t.symbol === bm.product),
      );
      if (!trade) continue;

      const fair = fairAtFill(trade, botStates);
      const edge = fair !== null ? tradeEdge(trade, fair) : null;
      const key = `${trade.timestamp}_${trade.symbol}_${trade.price}`;
      const outcome = outcomeByKey.get(key);
      const isGoodEntry = edge !== null && edge > 0;

      const edgeDesc = edge !== null
        ? edge > 0
          ? `${Math.abs(edge).toFixed(1)} SeaShells ${trade.submissionSide === 'buy' ? 'BELOW' : 'ABOVE'} fair value ✅`
          : `${Math.abs(edge).toFixed(1)} SeaShells ${trade.submissionSide === 'buy' ? 'ABOVE' : 'BELOW'} fair value ❌`
        : 'unknown edge (no fair value data)';

      let outcomeText = '';
      if (outcome?.fwd500 !== null && outcome?.fwd500 !== undefined) {
        const pnl500 = outcome.fwd500 * trade.quantity;
        outcomeText = pnl500 >= 0
          ? `500ms later: price moved in our favor → +${pnl500.toFixed(1)} cash ✅`
          : `500ms later: price moved against us → ${pnl500.toFixed(1)} cash ❌`;
      }

      cards.push({
        timestamp: bm.timestamp,
        type: 'fill',
        headline: `${trade.submissionSide === 'buy' ? '🟢 BOUGHT' : '🔴 SOLD'} ${trade.quantity} ${trade.symbol} at ${trade.price}`,
        body: fair !== null
          ? `Fair value was ${fair.toFixed(1)} — we traded ${edgeDesc}.`
          : 'No fair value data at this tick.',
        outcome: outcomeText || undefined,
        color: isGoodEntry ? '#a6e3a133' : '#f38ba833',
        emoji: trade.submissionSide === 'buy' ? '🟢' : '🔴',
      });
    } else if (bm.category === 'mode_switch') {
      const parts = bm.label.split('→');
      const toMode = parts[1]?.trim() ?? '';
      const plain = MODE_PLAIN[toMode] ?? toMode;
      const emoji = MODE_EMOJI[toMode] ?? '🔀';

      cards.push({
        timestamp: bm.timestamp,
        type: 'mode',
        headline: `${emoji} Strategy switched: ${bm.label}`,
        body: plain,
        color: '#89b4fa22',
        emoji,
      });
    } else if (bm.category === 'near_cap') {
      const product = bm.product ?? '';
      const cap = CAP_MAP[product] ?? 30;
      cards.push({
        timestamp: bm.timestamp,
        type: 'inventory',
        headline: `⚠️ Position limit warning — ${product}`,
        body: `We're holding a lot of ${product} (near the ${cap}-unit limit). The bot slows down or stops trading to avoid going over.`,
        color: '#fab38722',
        emoji: '⚠️',
      });
    } else if (bm.category === 'max_drawdown') {
      cards.push({
        timestamp: bm.timestamp,
        type: 'milestone',
        headline: `📉 Biggest dip in profit`,
        body: bm.label + ' — this was the largest drop from a previous high point.',
        color: '#f38ba822',
        emoji: '📉',
      });
    } else if (bm.category === 'max_profit') {
      cards.push({
        timestamp: bm.timestamp,
        type: 'milestone',
        headline: `📈 Peak profit reached`,
        body: bm.label,
        color: '#a6e3a122',
        emoji: '📈',
      });
    }
  }

  return cards.sort((a, b) => a.timestamp - b.timestamp);
}

function TradeLog() {
  const bookmarks = useReplayStore((s) => s.bookmarks);
  const trades = useReplayStore((s) => s.trades);
  const botStates = useReplayStore((s) => s.botStates);
  const tradeOutcomes = useReplayStore((s) => s.tradeOutcomes);
  const setActiveTimestamp = useReplayStore((s) => s.setActiveTimestamp);
  const setSimpleMode = useReplayStore((s) => s.setSimpleMode);

  const cards = useMemo(
    () => buildEventCards(bookmarks, trades, botStates, tradeOutcomes),
    [bookmarks, trades, botStates, tradeOutcomes],
  );

  const handleJump = (ts: number) => {
    setActiveTimestamp(ts);
    setSimpleMode(false); // switch to expert view
  };

  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ fontSize: 16, fontWeight: 'bold', color: '#cdd6f4', marginBottom: 6 }}>
        4. What happened, step by step
      </div>
      <div style={{ color: '#7f849c', fontSize: 12, marginBottom: 16, lineHeight: 1.6 }}>
        Key moments from the session. Click "Jump to this moment" to see the full details in Expert View.
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {cards.map((card, i) => (
          <div
            key={i}
            style={{
              background: card.color,
              border: '1px solid #313244',
              borderRadius: 8,
              padding: '12px 16px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
              <div>
                <span style={{ color: '#7f849c', fontSize: 10, marginRight: 8 }}>
                  ⏱ {(card.timestamp / 1000).toFixed(1)}s (ts={card.timestamp})
                </span>
                <span style={{ fontSize: 13, fontWeight: 'bold', color: '#cdd6f4' }}>
                  {card.headline}
                </span>
              </div>
              <button
                onClick={() => handleJump(card.timestamp)}
                style={{
                  padding: '2px 8px',
                  fontSize: 10,
                  borderRadius: 4,
                  border: '1px solid #45475a',
                  background: 'transparent',
                  color: '#89b4fa',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  marginLeft: 8,
                }}
              >
                Jump →
              </button>
            </div>
            <div style={{ fontSize: 12, color: '#a6adc8', lineHeight: 1.6 }}>{card.body}</div>
            {card.outcome && (
              <div style={{ fontSize: 12, color: '#cdd6f4', marginTop: 6, fontStyle: 'italic' }}>
                {card.outcome}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Section 5: Key Takeaways ──────────────────────────────────────────────────

function KeyTakeaways() {
  const meta = useReplayStore((s) => s.meta);
  const trades = useReplayStore((s) => s.trades);
  const botStates = useReplayStore((s) => s.botStates);
  const bookmarks = useReplayStore((s) => s.bookmarks);
  const productPnl = useReplayStore((s) => s.productPnl);
  const equityPoints = useReplayStore((s) => s.equityPoints);

  const insights = useMemo(() => {
    if (!meta) return [];
    const lines: { emoji: string; text: string; type: 'good' | 'warn' | 'info' }[] = [];

    // Profit
    lines.push({
      emoji: meta.profit >= 0 ? '💰' : '💸',
      text: `Your bot traded for ${equityPoints.length > 0 ? (equityPoints[equityPoints.length - 1].timestamp / 1000).toFixed(0) : '?'}s and ${meta.profit >= 0 ? 'made' : 'lost'} ${Math.abs(meta.profit).toFixed(2)} cash ${meta.profit >= 0 ? 'in profit' : 'overall'}.`,
      type: meta.profit >= 0 ? 'good' : 'warn',
    });

    // Per-product breakdown
    const products = [...new Set(trades.map((t) => t.symbol))];
    for (const product of products) {
      const series = productPnl[product];
      if (!series || series.length === 0) continue;
      const finalPnl = series[series.length - 1].pnl;

      // Mode breakdown for this product
      const productStates = botStates.filter((b) => b.product === product);
      const modeCounts: Record<string, number> = {};
      for (const bs of productStates) {
        modeCounts[bs.mode] = (modeCounts[bs.mode] ?? 0) + 1;
      }
      const dominantMode = Object.entries(modeCounts).sort((a, b) => b[1] - a[1])[0];

      lines.push({
        emoji: finalPnl >= 0 ? '✅' : '❌',
        text: `${product}: Made ${finalPnl >= 0 ? '+' : ''}${finalPnl.toFixed(0)} cash. Mostly used "${dominantMode?.[0] ?? 'passive'}" strategy (${MODE_PLAIN[dominantMode?.[0] ?? 'passive']?.split(' — ')[0]?.toLowerCase() ?? 'passive'}).`,
        type: finalPnl >= 0 ? 'good' : 'warn',
      });
    }

    // Trade quality
    let totalGood = 0, totalBad = 0;
    for (const trade of trades) {
      const fair = fairAtFill(trade, botStates);
      if (fair === null) continue;
      if (tradeEdge(trade, fair) > 0) totalGood++;
      else totalBad++;
    }
    const winRate = totalGood / (totalGood + totalBad);
    lines.push({
      emoji: winRate >= 0.6 ? '🎯' : winRate >= 0.4 ? '⚖️' : '⚠️',
      text: `${(winRate * 100).toFixed(0)}% of trades were at favorable prices vs fair value (${totalGood} good, ${totalBad} against edge).`,
      type: winRate >= 0.6 ? 'good' : winRate >= 0.4 ? 'info' : 'warn',
    });

    // Final inventory warning
    const nonFlatPositions = meta.positions.filter(
      (p) => p.symbol !== 'XIRECS' && Math.abs(p.quantity) > 0,
    );
    if (nonFlatPositions.length > 0) {
      for (const pos of nonFlatPositions) {
        const cap = CAP_MAP[pos.symbol] ?? 30;
        const pct = Math.abs(pos.quantity) / cap;
        if (pct > 0.2) {
          lines.push({
            emoji: '⚠️',
            text: `The session ended with ${pos.quantity >= 0 ? '+' : ''}${pos.quantity} ${pos.symbol} still held (${(pct * 100).toFixed(0)}% of cap). This is "open inventory" — if the price had moved against you after the session, you'd have lost some profit.`,
            type: 'warn',
          });
        }
      }
    }

    // Max drawdown
    const ddBookmark = bookmarks.find((b) => b.category === 'max_drawdown');
    if (ddBookmark) {
      lines.push({
        emoji: '📉',
        text: `The biggest single dip in profit happened around ${(ddBookmark.timestamp / 1000).toFixed(0)}s. ${ddBookmark.label}.`,
        type: 'info',
      });
    }

    return lines;
  }, [meta, trades, botStates, bookmarks, productPnl, equityPoints]);

  const TYPE_COLORS = { good: '#a6e3a1', warn: '#fab387', info: '#89b4fa' };

  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ fontSize: 16, fontWeight: 'bold', color: '#cdd6f4', marginBottom: 16 }}>
        5. Key Takeaways
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {insights.map((insight, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              gap: 12,
              background: '#181825',
              border: `1px solid ${TYPE_COLORS[insight.type]}33`,
              borderRadius: 8,
              padding: '12px 16px',
            }}
          >
            <span style={{ fontSize: 18, flexShrink: 0 }}>{insight.emoji}</span>
            <span style={{ fontSize: 13, color: '#cdd6f4', lineHeight: 1.7 }}>{insight.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main SimpleView ───────────────────────────────────────────────────────────

export function SimpleView() {
  const trades = useReplayStore((s) => s.trades);
  const products = useMemo(() => [...new Set(trades.map((t) => t.symbol))], [trades]);

  return (
    <div style={{ height: '100%', overflow: 'auto', background: '#1e1e2e' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '20px 24px' }}>

        {/* Intro */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 20, fontWeight: 'bold', color: '#89b4fa', marginBottom: 6 }}>
            Match Overview — Simple View
          </div>
          <div style={{ fontSize: 13, color: '#7f849c', lineHeight: 1.7 }}>
            The goal of this bot: figure out what an asset is truly worth (the "fair value"), then
            buy it when the market price is <strong style={{ color: '#a6e3a1' }}>below</strong> that,
            and sell when it is <strong style={{ color: '#f38ba8' }}>above</strong> that.
            The wider the gap between where you trade and fair value, the more profit you capture.
          </div>
        </div>

        {/* Section 1 */}
        <div style={{ fontSize: 16, fontWeight: 'bold', color: '#cdd6f4', marginBottom: 12 }}>
          1. Match Results at a Glance
        </div>
        <ScoreCards />

        {/* Section 2 */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 16, fontWeight: 'bold', color: '#cdd6f4', marginBottom: 6 }}>
            2. Real Value vs Market Price
          </div>
          <div style={{ color: '#7f849c', fontSize: 12, marginBottom: 12, lineHeight: 1.6 }}>
            The <span style={{ color: '#f9e2af', fontWeight: 'bold' }}>yellow dashed line</span> is what the bot thinks each asset is really worth.
            The <span style={{ color: '#9399b2', fontWeight: 'bold' }}>grey line</span> is what the market was actually charging.
            The <span style={{ color: '#a6e3a1', fontWeight: 'bold' }}>green shaded areas</span> are moments the market was CHEAP (good time to buy).
            The <span style={{ color: '#f38ba8', fontWeight: 'bold' }}>red shaded areas</span> are moments the market was EXPENSIVE (good time to sell).
          </div>

          {products.map((product) => (
            <div key={product} style={{ marginBottom: 20 }}>
              <div style={{ color: PRODUCT_COLORS[product] ?? '#cdd6f4', fontWeight: 'bold', fontSize: 13, marginBottom: 6 }}>
                {product}
              </div>
              <div style={{ background: '#181825', border: '1px solid #313244', borderRadius: 8, overflow: 'hidden' }}>
                <FairValueChart product={product} />
              </div>
            </div>
          ))}
        </div>

        {/* Section 3 */}
        <TradeQualitySection />

        {/* Section 4 */}
        <TradeLog />

        {/* Section 5 */}
        <KeyTakeaways />

        {/* Footer */}
        <div style={{ textAlign: 'center', color: '#45475a', fontSize: 11, padding: '16px 0 32px' }}>
          Click <strong>"📊 Expert View"</strong> in the top bar to return to the full analysis dashboard.
        </div>
      </div>
    </div>
  );
}
