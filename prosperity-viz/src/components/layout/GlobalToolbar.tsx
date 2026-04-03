import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useReplayStore } from '../../store/useReplayStore';
import { useEquityAtTimestamp } from '../../hooks/useTimestampSearch';
import { PRODUCT_COLORS } from '../../types/data';

const btnStyle: React.CSSProperties = {
  padding: '2px 8px',
  fontSize: 11,
  borderRadius: 3,
  border: '1px solid #313244',
  background: '#313244',
  color: '#cdd6f4',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

export function GlobalToolbar() {
  const meta = useReplayStore((s) => s.meta);
  const activeTimestamp = useReplayStore((s) => s.activeTimestamp);
  const navigateFill = useReplayStore((s) => s.navigateFill);
  const navigateModeSwitch = useReplayStore((s) => s.navigateModeSwitch);
  const jumpToTs = useReplayStore((s) => s.setActiveTimestamp);
  const reset = useReplayStore((s) => s.reset);
  const trades = useReplayStore((s) => s.trades);
  const productPnl = useReplayStore((s) => s.productPnl);
  const simpleMode = useReplayStore((s) => s.simpleMode);
  const setSimpleMode = useReplayStore((s) => s.setSimpleMode);
  const openHelp = useReplayStore((s) => s.openHelp);

  const [jumpInput, setJumpInput] = useState('');
  const equityPt = useEquityAtTimestamp(activeTimestamp);

  if (!meta) return null;

  const handleJump = () => {
    const ts = parseInt(jumpInput, 10);
    if (!isNaN(ts)) jumpToTs(Math.max(0, Math.min(ts, 199900)));
  };

  // Product PnL at active timestamp
  const productPnlAtTs: Record<string, number> = {};
  for (const [product, series] of Object.entries(productPnl)) {
    if (series.length === 0) continue;
    let val = series[0].pnl;
    for (const pt of series) {
      if (pt.timestamp <= activeTimestamp) val = pt.pnl;
      else break;
    }
    productPnlAtTs[product] = val;
  }

  const ownFills = trades.filter((t) => t.submissionSide !== null);
  const totalFills = ownFills.length;
  const tradesAtTs = ownFills.filter((t) => t.timestamp <= activeTimestamp).length;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '4px 10px',
      background: '#181825',
      borderBottom: '1px solid #313244',
      flexShrink: 0,
      flexWrap: 'wrap',
    }}>
      {/* Simple / Expert toggle */}
      <button
        onClick={() => setSimpleMode(!simpleMode)}
        style={{
          padding: '3px 10px',
          fontSize: 11,
          borderRadius: 4,
          border: `1px solid ${simpleMode ? '#a6e3a1' : '#89b4fa'}`,
          background: simpleMode ? '#a6e3a122' : '#89b4fa22',
          color: simpleMode ? '#a6e3a1' : '#89b4fa',
          cursor: 'pointer',
          fontWeight: 'bold',
          whiteSpace: 'nowrap',
        }}
        title={simpleMode ? 'Switch to Expert View (full charts)' : 'Switch to Simple View (plain English)'}
      >
        {simpleMode ? '📊 Expert View' : '🎓 Simple View'}
      </button>

      <button type="button" style={btnStyle} onClick={openHelp} title="Open user guide">
        How to use
      </button>
      <Link to="/backtest" style={{ ...btnStyle, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
        Backtest
      </Link>

      {/* Match info */}
      <span style={{ color: '#89b4fa', fontSize: 11, fontWeight: 'bold', marginRight: 4 }}>
        R{meta.round} · {meta.status}
      </span>

      {/* Final profit */}
      <span style={{ color: '#a6e3a1', fontSize: 11, fontFamily: 'monospace' }}>
        Final: +{meta.profit.toFixed(2)}
      </span>

      {/* Per-product PnL at cursor */}
      {Object.entries(productPnlAtTs).map(([product, pnl]) => (
        <span key={product} style={{ fontSize: 10, fontFamily: 'monospace', color: PRODUCT_COLORS[product] ?? '#cdd6f4' }}>
          {product}: {pnl >= 0 ? '+' : ''}{pnl.toFixed(0)}
        </span>
      ))}

      <div style={{ flex: 1 }} />

      {/* Equity at cursor */}
      {equityPt && (
        <span style={{ color: '#89dceb', fontSize: 11, fontFamily: 'monospace' }}>
          PnL@cursor: {equityPt.value >= 0 ? '+' : ''}{equityPt.value.toFixed(2)}
        </span>
      )}

      {/* Fills counter */}
      <span style={{ color: '#7f849c', fontSize: 10 }}>
        fills: {tradesAtTs}/{totalFills}
      </span>

      {/* Navigation (expert mode only) */}
      {!simpleMode && (
        <>
          <div style={{ display: 'flex', gap: 2 }}>
            <button style={btnStyle} onClick={() => navigateFill('prev')} title="Previous fill (←)">
              ← fill
            </button>
            <button style={btnStyle} onClick={() => navigateFill('next')} title="Next fill (→)">
              fill →
            </button>
            <button style={btnStyle} onClick={() => navigateModeSwitch('prev')} title="Previous mode switch (Shift+←)">
              ← mode
            </button>
            <button style={btnStyle} onClick={() => navigateModeSwitch('next')} title="Next mode switch (Shift+→)">
              mode →
            </button>
          </div>

          <span style={{ color: '#f9e2af', fontSize: 11, fontFamily: 'monospace' }}>
            ts={activeTimestamp} ({(activeTimestamp / 1000).toFixed(1)}s)
          </span>

          <div style={{ display: 'flex', gap: 2 }}>
            <input
              type="number"
              value={jumpInput}
              onChange={(e) => setJumpInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleJump()}
              placeholder="jump to ts"
              style={{
                width: 80,
                padding: '2px 6px',
                fontSize: 11,
                background: '#313244',
                border: '1px solid #45475a',
                borderRadius: 3,
                color: '#cdd6f4',
              }}
            />
            <button style={btnStyle} onClick={handleJump}>
              Jump
            </button>
          </div>
        </>
      )}

      {/* Reset */}
      <button
        style={{ ...btnStyle, color: '#f38ba8', borderColor: '#f38ba822' }}
        onClick={reset}
        title="Load new file"
      >
        ✕ Reset
      </button>
    </div>
  );
}
