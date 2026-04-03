// ── Raw parse outputs ────────────────────────────────────────────────────────

export interface BookRow {
  day: number;
  timestamp: number;
  product: string;
  bidPrice1: number;
  bidVolume1: number;
  bidPrice2: number | null;
  bidVolume2: number | null;
  bidPrice3: number | null;
  bidVolume3: number | null;
  askPrice1: number;
  askVolume1: number;
  askPrice2: number | null;
  askVolume2: number | null;
  askPrice3: number | null;
  askVolume3: number | null;
  midPrice: number;
  pnl: number;
}

export interface EquityPoint {
  timestamp: number;
  value: number;
}

export type BotMode = 'passive' | 'taker_imb' | 'taker_mr_buy' | 'taker_mr_sell' | 'skip';

export interface BotState {
  timestamp: number;
  product: string;
  inv: number;
  cap: number;
  mode: BotMode;
  fair: number;
  mid: number;
  imbalance: number;
  skew?: number;
  ewma?: number;
  dMid?: number;
  nOrders: number;
}

/** null = third-party / market tape (neither side is SUBMISSION in log). */
export type SubmissionSide = 'buy' | 'sell' | null;

export interface Trade {
  timestamp: number;
  symbol: string;
  price: number;
  quantity: number;
  /** Submission bought (buyer === SUBMISSION). */
  isBuy: boolean;
  /** buy | sell = our fill; null = tape trade (not our order). */
  submissionSide: SubmissionSide;
}

export interface Position {
  symbol: string;
  quantity: number;
}

export interface MatchMeta {
  round: string;
  status: string;
  profit: number;
  positions: Position[];
}

// ── Derived / joined ─────────────────────────────────────────────────────────

export interface MasterFrame {
  timestamp: number;
  product: string;
  book: BookRow;
  botState: BotState | null;
  tradesAtTick: Trade[];
}

export interface ModeSwitch {
  timestamp: number;
  product: string;
  fromMode: BotMode;
  toMode: BotMode;
}

export interface TradeOutcome {
  trade: Trade;
  fwd100: number | null;
  fwd500: number | null;
  fwd1000: number | null;
  fwd5000: number | null;
  adverseSelection500: number | null;
  adverseSelection5000: number | null;
  spreadAtFill: number;
}

export type BookmarkCategory =
  | 'max_drawdown'
  | 'max_profit'
  | 'near_cap'
  | 'mode_switch'
  | 'large_fill'
  | 'manual';

export interface Bookmark {
  id: string;
  timestamp: number;
  label: string;
  category: BookmarkCategory;
  product?: string;
}

// ── UI state ─────────────────────────────────────────────────────────────────

export type TabId = 'main' | 'inventory_risk';

export interface ViewportRange {
  xStart: number;
  xEnd: number;
}

export interface TradeFilter {
  products: string[];
  direction: 'all' | 'buy' | 'sell';
  timestampMin: number | null;
  timestampMax: number | null;
  onlyBookmarked: boolean;
}

export const CAP_MAP: Record<string, number> = {
  EMERALDS: 50,
  TOMATOES: 30,
};

export const PRODUCTS = ['EMERALDS', 'TOMATOES'] as const;
export type Product = (typeof PRODUCTS)[number];

export const MODE_COLORS: Record<BotMode, string> = {
  passive: '#585b70',
  taker_imb: '#fab387',
  taker_mr_buy: '#a6e3a1',
  taker_mr_sell: '#f38ba8',
  skip: '#313244',
};

export const PRODUCT_COLORS: Record<string, string> = {
  EMERALDS: '#a6e3a1',
  TOMATOES: '#f38ba8',
};
