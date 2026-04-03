import type { Trade } from '../types/data';

interface RawTrade {
  timestamp: number;
  buyer: string;
  seller: string;
  symbol: string;
  currency: string;
  price: number;
  quantity: number;
}

function submissionSideFromParties(buyer: string, seller: string): Trade['submissionSide'] {
  const b = buyer === 'SUBMISSION';
  const s = seller === 'SUBMISSION';
  if (b && s) return 'buy'; // degenerate: prefer buy if both tagged
  if (b) return 'buy';
  if (s) return 'sell';
  return null;
}

/** Parse tradeHistory[] from the .log file into Trade[] */
export function parseTradeHistory(raw: RawTrade[]): Trade[] {
  return raw.map((t) => {
    const submissionSide = submissionSideFromParties(t.buyer, t.seller);
    return {
      timestamp: t.timestamp,
      symbol: t.symbol,
      price: t.price,
      quantity: t.quantity,
      submissionSide,
      isBuy: submissionSide === 'buy',
    };
  });
}
