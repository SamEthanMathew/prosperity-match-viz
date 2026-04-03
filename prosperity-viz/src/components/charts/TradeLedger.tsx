import { useMemo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useReplayStore } from '../../store/useReplayStore';
import { fmtNum, fmtPnl } from '../../utils/formatters';

function fwdColor(val: number | null): string {
  if (val === null) return '#6c7086';
  return val > 0 ? '#a6e3a1' : val < 0 ? '#f38ba8' : '#cdd6f4';
}

const COL_STYLE: React.CSSProperties = {
  padding: '2px 6px',
  borderRight: '1px solid #313244',
  fontSize: 11,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

export function TradeLedger() {
  const tradeOutcomes = useReplayStore((s) => s.tradeOutcomes);
  const tradeFilter = useReplayStore((s) => s.tradeFilter);
  const setTradeFilter = useReplayStore((s) => s.setTradeFilter);
  const activeTimestamp = useReplayStore((s) => s.activeTimestamp);
  const setActiveTimestamp = useReplayStore((s) => s.setActiveTimestamp);
  const setActiveProduct = useReplayStore((s) => s.setActiveProduct);
  const bookmarks = useReplayStore((s) => s.bookmarks);
  const addManualBookmark = useReplayStore((s) => s.addManualBookmark);
  const removeBookmark = useReplayStore((s) => s.removeBookmark);

  const bookmarkedTs = useMemo(
    () => new Set(bookmarks.map((b) => b.timestamp)),
    [bookmarks],
  );

  const filtered = useMemo(() => {
    return tradeOutcomes.filter((o) => {
      const t = o.trade;
      if (tradeFilter.products.length > 0 && !tradeFilter.products.includes(t.symbol)) return false;
      if (tradeFilter.direction === 'buy' && t.submissionSide !== 'buy') return false;
      if (tradeFilter.direction === 'sell' && t.submissionSide !== 'sell') return false;
      if (tradeFilter.timestampMin !== null && t.timestamp < tradeFilter.timestampMin) return false;
      if (tradeFilter.timestampMax !== null && t.timestamp > tradeFilter.timestampMax) return false;
      if (tradeFilter.onlyBookmarked && !bookmarkedTs.has(t.timestamp)) return false;
      return true;
    });
  }, [tradeOutcomes, tradeFilter, bookmarkedTs]);

  const products = useMemo(
    () => [...new Set(tradeOutcomes.map((o) => o.trade.symbol))],
    [tradeOutcomes],
  );

  const parentRef = useRef<HTMLDivElement>(null);
  const ROW_HEIGHT = 26;

  const rowVirtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  });

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    background: '#181825',
    borderBottom: '1px solid #313244',
    fontSize: 10,
    color: '#7f849c',
    userSelect: 'none',
    flexShrink: 0,
  };

  const COLS = ['ts', 'sym', 'dir', 'price', 'qty', 'spr', 'f500', 'f5k', 'adv500', '⚑'];
  const COL_WIDTHS = [70, 75, 40, 60, 30, 35, 50, 50, 60, 28];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Title */}
      <div style={{ padding: '4px 8px', borderBottom: '1px solid #313244', color: '#89b4fa', fontSize: 11, fontWeight: 'bold', flexShrink: 0 }}>
        📋 Trade Ledger — {filtered.length}/{tradeOutcomes.length} trades
      </div>

      {/* Filters */}
      <div style={{ padding: '4px 8px', borderBottom: '1px solid #313244', display: 'flex', flexWrap: 'wrap', gap: 4, flexShrink: 0 }}>
        {/* Product filter */}
        <div style={{ display: 'flex', gap: 2 }}>
          {['all', ...products].map((p) => {
            const active =
              p === 'all'
                ? tradeFilter.products.length === 0
                : tradeFilter.products.includes(p);
            return (
              <button
                key={p}
                onClick={() =>
                  setTradeFilter({
                    products: p === 'all' ? [] : [p],
                  })
                }
                style={{
                  padding: '1px 6px',
                  fontSize: 10,
                  borderRadius: 3,
                  border: `1px solid ${active ? '#89b4fa' : '#313244'}`,
                  background: active ? '#313244' : 'transparent',
                  color: active ? '#cdd6f4' : '#7f849c',
                  cursor: 'pointer',
                }}
              >
                {p}
              </button>
            );
          })}
        </div>

        {/* Direction filter */}
        <div style={{ display: 'flex', gap: 2 }}>
          {(['all', 'buy', 'sell'] as const).map((d) => (
            <button
              key={d}
              onClick={() => setTradeFilter({ direction: d })}
              style={{
                padding: '1px 6px',
                fontSize: 10,
                borderRadius: 3,
                border: `1px solid ${tradeFilter.direction === d ? '#89b4fa' : '#313244'}`,
                background: tradeFilter.direction === d ? '#313244' : 'transparent',
                color: tradeFilter.direction === d ? '#cdd6f4' : '#7f849c',
                cursor: 'pointer',
              }}
            >
              {d}
            </button>
          ))}
        </div>

        {/* Bookmarked filter */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: '#7f849c', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={tradeFilter.onlyBookmarked}
            onChange={(e) => setTradeFilter({ onlyBookmarked: e.target.checked })}
          />
          bookmarked only
        </label>

        {/* Current ts highlight */}
        <button
          onClick={() => {
            const nearest = filtered.find((o) => o.trade.timestamp >= activeTimestamp);
            if (nearest) {
              setActiveTimestamp(nearest.trade.timestamp);
              setActiveProduct(nearest.trade.symbol);
            }
          }}
          style={{
            padding: '1px 6px',
            fontSize: 10,
            borderRadius: 3,
            border: '1px solid #313244',
            background: 'transparent',
            color: '#7f849c',
            cursor: 'pointer',
          }}
        >
          → next from ts
        </button>
      </div>

      {/* Table header */}
      <div style={headerStyle}>
        {COLS.map((col, i) => (
          <div key={col} style={{ ...COL_STYLE, width: COL_WIDTHS[i], minWidth: COL_WIDTHS[i] }}>
            {col}
          </div>
        ))}
      </div>

      {/* Virtualized rows */}
      <div ref={parentRef} style={{ flex: 1, overflow: 'auto', minHeight: 0, position: 'relative' }}>
        <div style={{ height: rowVirtualizer.getTotalSize() }}>
          {rowVirtualizer.getVirtualItems().map((virtualItem) => {
            const o = filtered[virtualItem.index];
            const t = o.trade;
            const isActive = Math.abs(t.timestamp - activeTimestamp) <= 100;
            const isBookmarked = bookmarkedTs.has(t.timestamp);

            return (
              <div
                key={virtualItem.key}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: ROW_HEIGHT,
                  transform: `translateY(${virtualItem.start}px)`,
                  display: 'flex',
                  alignItems: 'center',
                  background: isActive
                    ? '#2d2a45'
                    : virtualItem.index % 2 === 0
                    ? '#1e1e2e'
                    : '#181825',
                  borderLeft: `3px solid ${t.submissionSide === 'buy' ? '#a6e3a1' : '#f38ba8'}`,
                  cursor: 'pointer',
                }}
                onClick={() => {
                  setActiveTimestamp(t.timestamp);
                  setActiveProduct(t.symbol);
                }}
              >
                <div style={{ ...COL_STYLE, width: COL_WIDTHS[0], minWidth: COL_WIDTHS[0], color: '#a6adc8' }}>
                  {t.timestamp}
                </div>
                <div style={{ ...COL_STYLE, width: COL_WIDTHS[1], minWidth: COL_WIDTHS[1], color: '#89b4fa' }}>
                  {t.symbol}
                </div>
                <div style={{ ...COL_STYLE, width: COL_WIDTHS[2], minWidth: COL_WIDTHS[2], color: t.submissionSide === 'buy' ? '#a6e3a1' : '#f38ba8', fontWeight: 'bold' }}>
                  {t.submissionSide === 'buy' ? '▲B' : '▼S'}
                </div>
                <div style={{ ...COL_STYLE, width: COL_WIDTHS[3], minWidth: COL_WIDTHS[3], fontFamily: 'monospace' }}>
                  {t.price.toFixed(1)}
                </div>
                <div style={{ ...COL_STYLE, width: COL_WIDTHS[4], minWidth: COL_WIDTHS[4] }}>
                  {t.quantity}
                </div>
                <div style={{ ...COL_STYLE, width: COL_WIDTHS[5], minWidth: COL_WIDTHS[5], color: '#6c7086' }}>
                  {fmtNum(o.spreadAtFill, 1)}
                </div>
                <div style={{ ...COL_STYLE, width: COL_WIDTHS[6], minWidth: COL_WIDTHS[6], color: fwdColor(o.fwd500), fontFamily: 'monospace' }}>
                  {fmtPnl(o.fwd500)}
                </div>
                <div style={{ ...COL_STYLE, width: COL_WIDTHS[7], minWidth: COL_WIDTHS[7], color: fwdColor(o.fwd5000), fontFamily: 'monospace' }}>
                  {fmtPnl(o.fwd5000)}
                </div>
                <div
                  style={{
                    ...COL_STYLE,
                    width: COL_WIDTHS[8],
                    minWidth: COL_WIDTHS[8],
                    fontFamily: 'monospace',
                    color:
                      o.adverseSelection500 !== null && o.adverseSelection500 > 0
                        ? '#f38ba8'
                        : '#a6e3a1',
                  }}
                >
                  {fmtPnl(o.adverseSelection500)}
                </div>
                <div
                  style={{ ...COL_STYLE, width: COL_WIDTHS[9], minWidth: COL_WIDTHS[9], textAlign: 'center' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isBookmarked) {
                      const bm = bookmarks.find((b) => b.timestamp === t.timestamp && b.category === 'large_fill');
                      if (bm) removeBookmark(bm.id);
                    } else {
                      addManualBookmark(t.timestamp, `${t.submissionSide === 'buy' ? 'BUY' : 'SELL'} ${t.quantity} ${t.symbol} @${t.price}`);
                    }
                  }}
                >
                  <span style={{ color: isBookmarked ? '#f9e2af' : '#45475a', cursor: 'pointer' }}>⚑</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
