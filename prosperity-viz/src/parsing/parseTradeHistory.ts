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

/** Parse tradeHistory[] from the .log file into Trade[] */
export function parseTradeHistory(raw: RawTrade[]): Trade[] {
  return raw
    .filter((t) => t.buyer === 'SUBMISSION' || t.seller === 'SUBMISSION')
    .map((t) => ({
      timestamp: t.timestamp,
      symbol: t.symbol,
      price: t.price,
      quantity: t.quantity,
      isBuy: t.buyer === 'SUBMISSION',
    }));
}
