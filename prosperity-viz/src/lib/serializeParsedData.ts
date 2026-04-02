import type { ParsedData } from '../parsing/parseZip';

/** Full JSON snapshot of parsed match data for server-side re-analysis. */
export function serializeParsedData(data: ParsedData): string {
  return JSON.stringify(data);
}
