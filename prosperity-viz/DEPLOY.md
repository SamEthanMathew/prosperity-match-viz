# Deploying ProsperityIV Match Visualizer

The app is a static Vite + React build. After a match loads, users see a one-time (dismissible) banner suggesting a [GitHub star](https://github.com/SamEthanMathew/prosperity-match-viz) if the tool was useful — same ask as in the repo README. Optional **Supabase** integration uploads match archives when users opt in.

## Vercel

1. Import the Git repository and set **Root Directory** to `prosperity-viz` (the repo root is one level above this folder).
2. Framework: **Vite**, or leave auto-detect if Vercel picks it up.
3. **Build Command:** `npm run build`
4. **Output Directory:** `dist`
5. **Environment variables** (Production and Preview):
   - `VITE_SUPABASE_URL` — from Supabase Project Settings → API → Project URL
   - `VITE_SUPABASE_ANON_KEY` — anon **public** key (same screen)

If these are unset, the app runs normally; the share checkbox is hidden.

## Supabase setup

1. Create a project at [supabase.com](https://supabase.com).
2. In the SQL Editor, run either:
   - **`supabase/RUN_ALL_IN_SQL_EDITOR.sql`** (single paste, recommended), or
   - The two files **in order:** `supabase/migrations/001_match_submissions.sql`, then `002_storage_match_uploads.sql`.

   This creates the private bucket `match-uploads` (50 MB per object limit; increase in Dashboard → Storage → Configuration if needed).

   If you use **Cursor’s Supabase MCP** (`apply_migration` / `execute_sql`), point it at those same files or paste `RUN_ALL_IN_SQL_EDITOR.sql`—the AI must have Supabase MCP tools enabled for that chat.

3. **Row Level Security:** The migrations add INSERT-only access for `anon` and `authenticated` on `match_submissions` and INSERT-only on `storage.objects` for paths `matches/*/original.zip` and `matches/*/parsed.json`. There is **no** public read; use the Supabase Dashboard or service role to inspect data.

4. **CORS / Site URL:** Under Authentication → URL Configuration, add your Vercel production URL (and `http://localhost:5173` for local dev) if the Storage client reports CORS errors.

## Local development

```bash
cd prosperity-viz
cp .env.example .env.local
# Edit .env.local with your Supabase URL and anon key
npm install
npm run dev
```

## Verification checklist

- [ ] Load a zip with sharing **off** — app works, no upload requests in Network tab.
- [ ] Load a zip with sharing **on** — two `storage/v1/object/...` PUTs (or combined flow) and a `rest/v1/match_submissions` POST succeed (HTTP 200/201).
- [ ] Table Editor shows a new `match_submissions` row; Storage shows `matches/<uuid>/original.zip` and `parsed.json`.

## Abuse and limits

Anonymous uploads can be abused. Consider rate limiting, CAPTCHA, or a server-side proxy with a service role for production hardening. Very large parsed JSON files may exceed Storage limits—raise the limit or add compression in a follow-up.
