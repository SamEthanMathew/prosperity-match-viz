import type { ParsedData } from '../parsing/parseZip';
import { getSupabaseClient } from './supabaseClient';
import { serializeParsedData } from './serializeParsedData';

const BUCKET = 'match-uploads';

export type UploadMatchResult =
  | { ok: true }
  | { ok: false; message: string };

/** Upload original zip + parsed JSON to Storage and insert a metadata row. */
export async function uploadMatchToSupabase(
  file: File,
  parsed: ParsedData,
): Promise<UploadMatchResult> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { ok: false, message: 'Supabase is not configured' };
  }

  const submissionId = crypto.randomUUID();
  const zipPath = `matches/${submissionId}/original.zip`;
  const jsonPath = `matches/${submissionId}/parsed.json`;

  const { error: zipError } = await supabase.storage.from(BUCKET).upload(zipPath, file, {
    contentType: 'application/zip',
    upsert: false,
  });
  if (zipError) {
    console.error('[uploadMatchToSupabase] zip upload failed', zipError);
    return { ok: false, message: zipError.message };
  }

  let jsonBody: string;
  try {
    jsonBody = serializeParsedData(parsed);
  } catch (e) {
    console.error('[uploadMatchToSupabase] serialize failed', e);
    return { ok: false, message: 'Failed to serialize match data' };
  }

  const jsonBlob = new Blob([jsonBody], { type: 'application/json' });
  const { error: jsonError } = await supabase.storage.from(BUCKET).upload(jsonPath, jsonBlob, {
    contentType: 'application/json',
    upsert: false,
  });
  if (jsonError) {
    console.error('[uploadMatchToSupabase] json upload failed', jsonError);
    return { ok: false, message: jsonError.message };
  }

  const meta = {
    round: parsed.meta.round,
    status: parsed.meta.status,
    profit: parsed.meta.profit,
    trade_count: parsed.trades.length,
    book_row_count: parsed.bookRows.length,
    bot_state_count: parsed.botStates.length,
    mode_switch_count: parsed.modeSwitches.length,
    master_frame_count: parsed.masterFrames.length,
    client_version: 'prosperity-viz@0.0.0',
  };

  const { error: dbError } = await supabase.from('match_submissions').insert({
    zip_object_path: zipPath,
    parsed_object_path: jsonPath,
    meta,
  });
  if (dbError) {
    console.error('[uploadMatchToSupabase] db insert failed', dbError);
    return { ok: false, message: dbError.message };
  }

  return { ok: true };
}
