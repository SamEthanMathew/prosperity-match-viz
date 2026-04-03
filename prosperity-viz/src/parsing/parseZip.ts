import JSZip from 'jszip';
import { parseActivitiesLog } from './parseActivitiesLog';
import { parseGraphLog } from './parseGraphLog';
import { parseLambdaLogs } from './parseLambdaLog';
import { parseTradeHistory } from './parseTradeHistory';
import {
  buildMasterFrames,
  detectModeSwitches,
  computeTradeOutcomes,
  generateBookmarks,
  computeProductPnl,
} from './buildDerivedData';
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
  Position,
} from '../types/data';

export interface ParsedData {
  meta: MatchMeta;
  bookRows: BookRow[];
  equityPoints: EquityPoint[];
  botStates: BotState[];
  trades: Trade[];
  masterFrames: MasterFrame[];
  modeSwitches: ModeSwitch[];
  tradeOutcomes: TradeOutcome[];
  bookmarks: Bookmark[];
  productPnl: Record<string, { timestamp: number; pnl: number }[]>;
}

interface JsonFile {
  round: string;
  status: string;
  profit: number;
  activitiesLog: string;
  graphLog: string;
  positions: Position[];
}

interface LogFile {
  activitiesLog?: string;
  logs: Array<{ timestamp: number; sandboxLog: string; lambdaLog: string }>;
  tradeHistory: Array<{
    timestamp: number;
    buyer: string;
    seller: string;
    symbol: string;
    currency: string;
    price: number;
    quantity: number;
  }>;
}

export async function parseZipFile(file: File): Promise<ParsedData> {
  const zip = await JSZip.loadAsync(file);

  let jsonText: string | null = null;
  let logText: string | null = null;

  for (const [name, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    const lower = name.toLowerCase();
    if (lower.endsWith('.json') && !lower.includes('/')) {
      jsonText = await entry.async('text');
    } else if (lower.endsWith('.log') && !lower.includes('/')) {
      logText = await entry.async('text');
    }
  }

  if (!jsonText) throw new Error('No .json file found in zip');
  if (!logText) throw new Error('No .log file found in zip');

  const jsonData = JSON.parse(jsonText) as JsonFile;
  const logData = JSON.parse(logText) as LogFile;

  // Parse raw data
  const bookRows = parseActivitiesLog(jsonData.activitiesLog);
  const equityPoints = parseGraphLog(jsonData.graphLog);
  const botStates = parseLambdaLogs(logData.logs);
  const trades = parseTradeHistory(logData.tradeHistory);
  const submissionTrades = trades.filter((t) => t.submissionSide !== null);

  // Build derived data (masterFrames keep full tape for context; analytics = submission fills only)
  const masterFrames = buildMasterFrames(bookRows, botStates, trades);
  const modeSwitches = detectModeSwitches(botStates);
  const tradeOutcomes = computeTradeOutcomes(submissionTrades, bookRows);
  const bookmarks = generateBookmarks(equityPoints, masterFrames, submissionTrades, modeSwitches);
  const productPnl = computeProductPnl(submissionTrades, equityPoints);

  const meta: MatchMeta = {
    round: jsonData.round,
    status: jsonData.status,
    profit: jsonData.profit,
    positions: jsonData.positions,
  };

  return {
    meta,
    bookRows,
    equityPoints,
    botStates,
    trades,
    masterFrames,
    modeSwitches,
    tradeOutcomes,
    bookmarks,
    productPnl,
  };
}
