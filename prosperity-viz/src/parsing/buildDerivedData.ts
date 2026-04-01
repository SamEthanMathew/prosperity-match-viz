import type {
  BookRow,
  EquityPoint,
  BotState,
  Trade,
  MasterFrame,
  ModeSwitch,
  TradeOutcome,
  Bookmark,
  BookmarkCategory,
} from '../types/data';
import { CAP_MAP } from '../types/data';

// ── Helpers ──────────────────────────────────────────────────────────────────

function bookKey(ts: number, product: string): string {
  return `${ts}_${product}`;
}

// ── MasterFrames ─────────────────────────────────────────────────────────────

function buildCarryForwardBotStates(
  botStates: BotState[],
  products: string[],
  allTimestamps: number[],
): Map<string, BotState> {
  const result = new Map<string, BotState>();

  for (const product of products) {
    const productStates = botStates
      .filter((b) => b.product === product)
      .sort((a, b) => a.timestamp - b.timestamp);

    let stateIdx = 0;
    let lastState: BotState | null = null;

    for (const ts of allTimestamps) {
      // Advance to the latest state at or before ts
      while (stateIdx < productStates.length && productStates[stateIdx].timestamp <= ts) {
        lastState = productStates[stateIdx];
        stateIdx++;
      }
      if (lastState !== null) {
        result.set(bookKey(ts, product), lastState);
      }
    }
  }

  return result;
}

export function buildMasterFrames(
  bookRows: BookRow[],
  botStates: BotState[],
  trades: Trade[],
): MasterFrame[] {
  const products = [...new Set(bookRows.map((r) => r.product))];
  const allTimestamps = [...new Set(bookRows.map((r) => r.timestamp))].sort((a, b) => a - b);

  // Build book lookup
  const bookMap = new Map<string, BookRow>();
  for (const row of bookRows) {
    bookMap.set(bookKey(row.timestamp, row.product), row);
  }

  // Build carry-forward bot states
  const resolvedBotStates = buildCarryForwardBotStates(botStates, products, allTimestamps);

  // Build trades lookup
  const tradesMap = new Map<string, Trade[]>();
  for (const trade of trades) {
    const key = bookKey(trade.timestamp, trade.symbol);
    const existing = tradesMap.get(key) ?? [];
    existing.push(trade);
    tradesMap.set(key, existing);
  }

  // Build master frames from bookRows
  const frames: MasterFrame[] = [];
  for (const row of bookRows) {
    const key = bookKey(row.timestamp, row.product);
    frames.push({
      timestamp: row.timestamp,
      product: row.product,
      book: row,
      botState: resolvedBotStates.get(key) ?? null,
      tradesAtTick: tradesMap.get(key) ?? [],
    });
  }

  return frames;
}

// ── Mode switches ─────────────────────────────────────────────────────────────

export function detectModeSwitches(botStates: BotState[]): ModeSwitch[] {
  const products = [...new Set(botStates.map((b) => b.product))];
  const switches: ModeSwitch[] = [];

  for (const product of products) {
    const productStates = botStates
      .filter((b) => b.product === product)
      .sort((a, b) => a.timestamp - b.timestamp);

    for (let i = 1; i < productStates.length; i++) {
      const prev = productStates[i - 1];
      const curr = productStates[i];
      if (prev.mode !== curr.mode) {
        switches.push({
          timestamp: curr.timestamp,
          product,
          fromMode: prev.mode,
          toMode: curr.mode,
        });
      }
    }
  }

  return switches.sort((a, b) => a.timestamp - b.timestamp);
}

// ── Forward PnL & Adverse Selection ──────────────────────────────────────────

const FWD_HORIZONS = [100, 500, 1000, 5000] as const;

export function computeTradeOutcomes(
  trades: Trade[],
  bookRows: BookRow[],
): TradeOutcome[] {
  // Build fast book lookup: ts_product → BookRow
  const bookMap = new Map<string, BookRow>();
  for (const row of bookRows) {
    bookMap.set(bookKey(row.timestamp, row.product), row);
  }

  return trades.map((trade) => {
    const fillBook = bookMap.get(bookKey(trade.timestamp, trade.symbol));
    const spreadAtFill = fillBook
      ? fillBook.askPrice1 - fillBook.bidPrice1
      : 0;

    const fwdValues: Record<number, number | null> = {};
    for (const h of FWD_HORIZONS) {
      const fwdBook = bookMap.get(bookKey(trade.timestamp + h, trade.symbol));
      if (!fwdBook) {
        fwdValues[h] = null;
      } else {
        const midFwd = fwdBook.midPrice;
        fwdValues[h] = trade.isBuy
          ? midFwd - trade.price
          : trade.price - midFwd;
      }
    }

    const fwd500 = fwdValues[500];
    const fwd5000 = fwdValues[5000];

    return {
      trade,
      fwd100: fwdValues[100],
      fwd500,
      fwd1000: fwdValues[1000],
      fwd5000,
      adverseSelection500: fwd500 !== null ? -fwd500 : null,
      adverseSelection5000: fwd5000 !== null ? -fwd5000 : null,
      spreadAtFill,
    };
  });
}

// ── Auto-bookmarks ────────────────────────────────────────────────────────────

function makeBookmark(
  id: string,
  timestamp: number,
  label: string,
  category: BookmarkCategory,
  product?: string,
): Bookmark {
  return { id, timestamp, label, category, product };
}

export function generateBookmarks(
  equityPoints: EquityPoint[],
  masterFrames: MasterFrame[],
  trades: Trade[],
  modeSwitches: ModeSwitch[],
): Bookmark[] {
  const bookmarks: Bookmark[] = [];

  // A. Max drawdown
  if (equityPoints.length > 0) {
    let runMax = equityPoints[0].value;
    let maxDrawdown = 0;
    let maxDrawdownTs = equityPoints[0].timestamp;
    for (const pt of equityPoints) {
      if (pt.value > runMax) runMax = pt.value;
      const dd = runMax - pt.value;
      if (dd > maxDrawdown) {
        maxDrawdown = dd;
        maxDrawdownTs = pt.timestamp;
      }
    }
    if (maxDrawdown > 0) {
      bookmarks.push(
        makeBookmark(
          `max_drawdown_${maxDrawdownTs}`,
          maxDrawdownTs,
          `Max Drawdown (-${maxDrawdown.toFixed(1)})`,
          'max_drawdown',
        ),
      );
    }
  }

  // B. Max profit
  if (equityPoints.length > 0) {
    const maxPt = equityPoints.reduce((a, b) => (b.value > a.value ? b : a));
    bookmarks.push(
      makeBookmark(
        `max_profit_${maxPt.timestamp}`,
        maxPt.timestamp,
        `Peak PnL (+${maxPt.value.toFixed(1)})`,
        'max_profit',
      ),
    );
  }

  // C. Near-cap events per product
  const NEAR_CAP_FRAC = 0.85;
  const DEBOUNCE_MS = 2000;
  const products = [...new Set(masterFrames.map((f) => f.product))];

  for (const prod of products) {
    let lastBookmarkedTs = -Infinity;
    for (const frame of masterFrames) {
      if (frame.product !== prod) continue;
      const bs = frame.botState;
      if (!bs) continue;
      const ratio = Math.abs(bs.inv) / bs.cap;
      if (ratio >= NEAR_CAP_FRAC && frame.timestamp - lastBookmarkedTs > DEBOUNCE_MS) {
        bookmarks.push(
          makeBookmark(
            `near_cap_${prod}_${frame.timestamp}`,
            frame.timestamp,
            `Near-Cap ${prod} (${bs.inv}/${bs.cap})`,
            'near_cap',
            prod,
          ),
        );
        lastBookmarkedTs = frame.timestamp;
      }
    }
  }

  // D. Mode switches (taker entries only)
  for (const ms of modeSwitches) {
    if (ms.toMode !== 'passive' && ms.toMode !== 'skip') {
      bookmarks.push(
        makeBookmark(
          `mode_switch_${ms.product}_${ms.timestamp}`,
          ms.timestamp,
          `${ms.product}: →${ms.toMode}`,
          'mode_switch',
          ms.product,
        ),
      );
    }
  }

  // E. Large fills
  for (const trade of trades) {
    const cap = CAP_MAP[trade.symbol] ?? 30;
    if (trade.quantity >= Math.ceil(cap * 0.1)) {
      bookmarks.push(
        makeBookmark(
          `large_fill_${trade.symbol}_${trade.timestamp}_${trade.price}`,
          trade.timestamp,
          `Large Fill: ${trade.isBuy ? 'BUY' : 'SELL'} ${trade.quantity} ${trade.symbol} @${trade.price}`,
          'large_fill',
          trade.symbol,
        ),
      );
    }
  }

  return bookmarks.sort((a, b) => a.timestamp - b.timestamp);
}

// ── Realized PnL per product over time ───────────────────────────────────────

/** Compute cumulative realized PnL per product at each timestamp in equityPoints */
export function computeProductPnl(
  trades: Trade[],
  equityPoints: EquityPoint[],
): Record<string, { timestamp: number; pnl: number }[]> {
  const products = [...new Set(trades.map((t) => t.symbol))];
  const result: Record<string, { timestamp: number; pnl: number }[]> = {};

  for (const product of products) {
    const productTrades = trades
      .filter((t) => t.symbol === product)
      .sort((a, b) => a.timestamp - b.timestamp);

    let cumPnl = 0;
    let tradeIdx = 0;
    const series: { timestamp: number; pnl: number }[] = [];

    for (const ep of equityPoints) {
      while (tradeIdx < productTrades.length && productTrades[tradeIdx].timestamp <= ep.timestamp) {
        const t = productTrades[tradeIdx];
        // Cash flow: buy costs money, sell earns money
        cumPnl += t.isBuy ? -t.price * t.quantity : t.price * t.quantity;
        tradeIdx++;
      }
      series.push({ timestamp: ep.timestamp, pnl: cumPnl });
    }

    result[product] = series;
  }

  return result;
}
