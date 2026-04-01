import type { BookRow } from '../../types/data';

interface Props {
  book: BookRow;
  fair?: number;
}

export function BookDepthBar({ book, fair }: Props) {
  const bids = [
    book.bidPrice1 !== null ? { price: book.bidPrice1, vol: book.bidVolume1 } : null,
    book.bidPrice2 !== null ? { price: book.bidPrice2, vol: book.bidVolume2 } : null,
  ].filter(Boolean) as { price: number; vol: number | null }[];

  const asks = [
    book.askPrice1 !== null ? { price: book.askPrice1, vol: book.askVolume1 } : null,
    book.askPrice2 !== null ? { price: book.askPrice2, vol: book.askVolume2 } : null,
  ].filter(Boolean) as { price: number; vol: number | null }[];

  const maxVol = Math.max(
    ...bids.map((b) => b.vol ?? 0),
    ...asks.map((a) => a.vol ?? 0),
    1,
  );

  const BAR_HEIGHT = 20;
  const GAP = 4;
  const LABEL_W = 52;
  const BAR_MAX_W = 100;
  const W = 280;
  const H = (bids.length + asks.length) * (BAR_HEIGHT + GAP) + 30;

  return (
    <svg width={W} height={H} style={{ fontFamily: 'monospace', fontSize: 11 }}>
      {/* Header */}
      <text x={W / 2} y={14} textAnchor="middle" fill="#a6adc8" fontSize={10}>
        BID ←  → ASK
      </text>

      {/* Bids (top, green) */}
      {bids.map((b, i) => {
        const volFrac = (b.vol ?? 0) / maxVol;
        const barW = volFrac * BAR_MAX_W;
        const y = 22 + i * (BAR_HEIGHT + GAP);
        return (
          <g key={`bid${i}`}>
            {/* Bar (right-aligned to center) */}
            <rect
              x={W / 2 - LABEL_W - barW}
              y={y}
              width={barW}
              height={BAR_HEIGHT}
              fill="rgba(166,227,161,0.4)"
              rx={2}
            />
            {/* Price label */}
            <text x={W / 2 - LABEL_W - barW - 4} y={y + 13} textAnchor="end" fill="#a6e3a1" fontSize={10}>
              {b.price.toFixed(0)}
            </text>
            {/* Vol label */}
            <text x={W / 2 - LABEL_W / 2} y={y + 13} textAnchor="middle" fill="#6c7086" fontSize={9}>
              {b.vol ?? 0}
            </text>
          </g>
        );
      })}

      {/* Center line */}
      <line x1={W / 2} y1={18} x2={W / 2} y2={H - 5} stroke="#45475a" strokeWidth={1} />

      {/* Fair value marker */}
      {fair !== undefined && bids.length > 0 && asks.length > 0 && (
        (() => {
          const minP = bids[bids.length - 1].price;
          const maxP = asks[asks.length - 1].price;
          const range = maxP - minP;
          if (range <= 0) return null;
          const fairX = W / 2 - LABEL_W + ((fair - minP) / range) * (LABEL_W * 2);
          return (
            <line
              x1={fairX}
              y1={18}
              x2={fairX}
              y2={H - 5}
              stroke="#f9e2af"
              strokeWidth={1.5}
              strokeDasharray="3,2"
            />
          );
        })()
      )}

      {/* Asks (bottom, red) */}
      {asks.map((a, i) => {
        const volFrac = (a.vol ?? 0) / maxVol;
        const barW = volFrac * BAR_MAX_W;
        const y = 22 + (bids.length + i) * (BAR_HEIGHT + GAP);
        return (
          <g key={`ask${i}`}>
            {/* Bar (left-aligned from center) */}
            <rect
              x={W / 2 + LABEL_W}
              y={y}
              width={barW}
              height={BAR_HEIGHT}
              fill="rgba(243,139,168,0.4)"
              rx={2}
            />
            {/* Price label */}
            <text x={W / 2 + LABEL_W + barW + 4} y={y + 13} textAnchor="start" fill="#f38ba8" fontSize={10}>
              {a.price.toFixed(0)}
            </text>
            {/* Vol label */}
            <text x={W / 2 + LABEL_W / 2} y={y + 13} textAnchor="middle" fill="#6c7086" fontSize={9}>
              {a.vol ?? 0}
            </text>
          </g>
        );
      })}

      {/* Spread label */}
      {bids.length > 0 && asks.length > 0 && (
        <text
          x={W / 2}
          y={H - 4}
          textAnchor="middle"
          fill="#6c7086"
          fontSize={9}
        >
          spread: {(asks[0].price - bids[0].price).toFixed(1)}
        </text>
      )}
    </svg>
  );
}
