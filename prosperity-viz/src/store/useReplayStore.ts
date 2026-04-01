import { create } from 'zustand';
import type {
  BookRow,
  EquityPoint,
  BotState,
  Trade,
  MasterFrame,
  ModeSwitch,
  TradeOutcome,
  Bookmark,
  MatchMeta,
  TabId,
  ViewportRange,
  TradeFilter,
} from '../types/data';
import type { ParsedData } from '../parsing/parseZip';
import { prevTimestamp, nextTimestamp } from '../utils/arrayUtils';

interface ReplayState {
  // ── Parsed data ──────────────────────────────────────────────────────────
  meta: MatchMeta | null;
  bookRows: BookRow[];
  equityPoints: EquityPoint[];
  botStates: BotState[];
  trades: Trade[];
  masterFrames: MasterFrame[];
  modeSwitches: ModeSwitch[];
  tradeOutcomes: TradeOutcome[];
  bookmarks: Bookmark[];
  productPnl: Record<string, { timestamp: number; pnl: number }[]>;

  // ── UI state ─────────────────────────────────────────────────────────────
  activeTimestamp: number;
  activeProduct: string;
  viewportRange: ViewportRange | null;
  activeTab: TabId;
  tradeFilter: TradeFilter;
  isLoading: boolean;
  loadError: string | null;

  // ── Actions ──────────────────────────────────────────────────────────────
  loadData: (data: ParsedData) => void;
  setLoading: (loading: boolean, error?: string) => void;
  setActiveTimestamp: (ts: number) => void;
  setActiveProduct: (product: string) => void;
  setViewportRange: (range: ViewportRange | null) => void;
  setActiveTab: (tab: TabId) => void;
  setTradeFilter: (filter: Partial<TradeFilter>) => void;
  navigateFill: (direction: 'next' | 'prev') => void;
  navigateModeSwitch: (direction: 'next' | 'prev') => void;
  addManualBookmark: (ts: number, label: string) => void;
  removeBookmark: (id: string) => void;
  reset: () => void;
}

const DEFAULT_FILTER: TradeFilter = {
  products: [],
  direction: 'all',
  timestampMin: null,
  timestampMax: null,
  onlyBookmarked: false,
};

const initialState = {
  meta: null,
  bookRows: [] as BookRow[],
  equityPoints: [] as EquityPoint[],
  botStates: [] as BotState[],
  trades: [] as Trade[],
  masterFrames: [] as MasterFrame[],
  modeSwitches: [] as ModeSwitch[],
  tradeOutcomes: [] as TradeOutcome[],
  bookmarks: [] as Bookmark[],
  productPnl: {} as Record<string, { timestamp: number; pnl: number }[]>,
  activeTimestamp: 0,
  activeProduct: 'TOMATOES',
  viewportRange: null as ViewportRange | null,
  activeTab: 'main' as TabId,
  tradeFilter: DEFAULT_FILTER,
  isLoading: false,
  loadError: null as string | null,
};

export const useReplayStore = create<ReplayState>()((set, get) => ({
  ...initialState,

  loadData: (data: ParsedData) => {
    set({
      ...initialState,
      meta: data.meta,
      bookRows: data.bookRows,
      equityPoints: data.equityPoints,
      botStates: data.botStates,
      trades: data.trades,
      masterFrames: data.masterFrames,
      modeSwitches: data.modeSwitches,
      tradeOutcomes: data.tradeOutcomes,
      bookmarks: data.bookmarks,
      productPnl: data.productPnl,
      activeTimestamp: 0,
      isLoading: false,
      loadError: null,
    });
  },

  setLoading: (loading: boolean, error?: string) => {
    set({ isLoading: loading, loadError: error ?? null });
  },

  setActiveTimestamp: (ts: number) => {
    set({ activeTimestamp: ts });
  },

  setActiveProduct: (product: string) => {
    set({ activeProduct: product });
  },

  setViewportRange: (range: ViewportRange | null) => {
    set({ viewportRange: range });
  },

  setActiveTab: (tab: TabId) => {
    set({ activeTab: tab });
  },

  setTradeFilter: (filter: Partial<TradeFilter>) => {
    set((state) => ({ tradeFilter: { ...state.tradeFilter, ...filter } }));
  },

  navigateFill: (direction: 'next' | 'prev') => {
    const { trades, activeTimestamp } = get();
    if (trades.length === 0) return;
    const sorted = [...trades].sort((a, b) => a.timestamp - b.timestamp);
    const target =
      direction === 'next'
        ? nextTimestamp(sorted, activeTimestamp, (t) => t.timestamp)
        : prevTimestamp(sorted, activeTimestamp, (t) => t.timestamp);
    if (target) set({ activeTimestamp: target.timestamp });
  },

  navigateModeSwitch: (direction: 'next' | 'prev') => {
    const { modeSwitches, activeTimestamp } = get();
    if (modeSwitches.length === 0) return;
    const target =
      direction === 'next'
        ? nextTimestamp(modeSwitches, activeTimestamp, (m) => m.timestamp)
        : prevTimestamp(modeSwitches, activeTimestamp, (m) => m.timestamp);
    if (target) set({ activeTimestamp: target.timestamp });
  },

  addManualBookmark: (ts: number, label: string) => {
    const id = `manual_${ts}_${Date.now()}`;
    set((state) => ({
      bookmarks: [
        ...state.bookmarks,
        { id, timestamp: ts, label, category: 'manual' as const },
      ].sort((a, b) => a.timestamp - b.timestamp),
    }));
  },

  removeBookmark: (id: string) => {
    set((state) => ({
      bookmarks: state.bookmarks.filter((b) => b.id !== id),
    }));
  },

  reset: () => {
    set({ ...initialState });
  },
}));
