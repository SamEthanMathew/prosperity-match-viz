import type { BookRow } from '../types/data';

/**
 * Parse activitiesLog CSV string into BookRow[].
 *
 * Column order (interleaved price/volume, NOT grouped):
 * 0=day, 1=timestamp, 2=product,
 * 3=bid_price_1, 4=bid_volume_1,
 * 5=bid_price_2, 6=bid_volume_2,
 * 7=bid_price_3, 8=bid_volume_3,
 * 9=ask_price_1, 10=ask_volume_1,
 * 11=ask_price_2, 12=ask_volume_2,
 * 13=ask_price_3, 14=ask_volume_3,
 * 15=mid_price, 16=profit_and_loss
 */
export function parseActivitiesLog(raw: string): BookRow[] {
  const lines = raw.split('\n');
  const rows: BookRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols = line.split(';');
    if (cols.length < 17) continue;

    const parseF = (s: string): number | null => {
      const trimmed = s.trim();
      if (trimmed === '' || trimmed === 'nan') return null;
      const n = parseFloat(trimmed);
      return isNaN(n) ? null : n;
    };
    const parseI = (s: string): number | null => {
      const trimmed = s.trim();
      if (trimmed === '' || trimmed === 'nan') return null;
      const n = parseInt(trimmed, 10);
      return isNaN(n) ? null : n;
    };

    const bidPrice1 = parseF(cols[3]);
    const bidVolume1 = parseI(cols[4]);
    const askPrice1 = parseF(cols[9]);
    const askVolume1 = parseI(cols[10]);

    if (bidPrice1 === null || bidVolume1 === null || askPrice1 === null || askVolume1 === null) continue;

    rows.push({
      day: parseInt(cols[0].trim(), 10),
      timestamp: parseInt(cols[1].trim(), 10),
      product: cols[2].trim(),
      bidPrice1,
      bidVolume1,
      bidPrice2: parseF(cols[5]),
      bidVolume2: parseI(cols[6]),
      bidPrice3: parseF(cols[7]),
      bidVolume3: parseI(cols[8]),
      askPrice1,
      askVolume1,
      askPrice2: parseF(cols[11]),
      askVolume2: parseI(cols[12]),
      askPrice3: parseF(cols[13]),
      askVolume3: parseI(cols[14]),
      midPrice: parseF(cols[15]) ?? (bidPrice1 + askPrice1) / 2,
      pnl: parseF(cols[16]) ?? 0,
    });
  }

  return rows;
}
