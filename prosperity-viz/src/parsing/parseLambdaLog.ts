import type { BotState, BotMode } from '../types/data';

interface RawLogEntry {
  timestamp: number;
  lambdaLog: string;
}

const BOT_LINE_RE = /^BOTv[\d.]+ (\w+) /;
const KV_RE = /(\w+)=([\w.+\-]+)/g;

function parseMode(s: string): BotMode {
  if (s === 'passive') return 'passive';
  if (s === 'taker_imb') return 'taker_imb';
  if (s === 'taker_mr_buy') return 'taker_mr_buy';
  if (s === 'taker_mr_sell') return 'taker_mr_sell';
  return 'skip';
}

/** Parse logs[] from the .log file into BotState[] */
export function parseLambdaLogs(logs: RawLogEntry[]): BotState[] {
  const states: BotState[] = [];

  for (const entry of logs) {
    if (!entry.lambdaLog) continue;
    const lines = entry.lambdaLog.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      const productMatch = trimmed.match(BOT_LINE_RE);
      if (!productMatch) continue;
      const product = productMatch[1];

      const fields: Record<string, string> = {};
      let m: RegExpExecArray | null;
      const re = new RegExp(KV_RE.source, 'g');
      while ((m = re.exec(trimmed)) !== null) {
        fields[m[1]] = m[2];
      }

      const inv = parseInt(fields['inv'] ?? '0', 10);
      const cap = parseInt(fields['cap'] ?? '0', 10);
      const fair = parseFloat(fields['fair'] ?? '0');
      const mid = parseFloat(fields['mid'] ?? '0');
      const imbalance = parseFloat(fields['I'] ?? '0');
      const nOrders = parseInt(fields['n_orders'] ?? '0', 10);
      const mode = parseMode(fields['mode'] ?? 'passive');

      const state: BotState = {
        timestamp: entry.timestamp,
        product,
        inv,
        cap,
        mode,
        fair,
        mid,
        imbalance,
        nOrders,
      };

      if (fields['skew'] !== undefined) state.skew = parseInt(fields['skew'], 10);
      if (fields['ewma'] !== undefined) state.ewma = parseFloat(fields['ewma']);
      if (fields['dMid'] !== undefined) state.dMid = parseFloat(fields['dMid']);

      states.push(state);
    }
  }

  return states;
}
