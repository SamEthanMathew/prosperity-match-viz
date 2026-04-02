# Deploying ProsperityIV Match Visualizer

The app is a static Vite + React build. After a match loads, users see a one-time (dismissible) banner suggesting a [GitHub star](https://github.com/SamEthanMathew/prosperity-match-viz) if the tool was useful — same ask as in the repo README. Optional **Supabase** integration uploads match archives when users opt in.

## How optional match sharing works

Nothing is sent to Supabase unless **both** are true:

1. **Build/runtime config:** `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set (Vite inlines these at **build time** — after changing them in Vercel, trigger a **new deployment**).
2. **User choice:** On the upload screen, the **“Share this match…”** checkbox appears only when Supabase is configured; the user must check it before loading the zip.

If either condition fails, the `.zip` is parsed **only in the browser** and kept in memory — no server copy.

When sharing **is** on, the client:

- Uploads the **original zip** to Storage: `matches/<uuid>/original.zip`
- Uploads **parsed match JSON** to Storage: `matches/<uuid>/parsed.json`
- Inserts one row in **`match_submissions`** with those paths plus a small **meta** summary (round, status, profit, row counts, client version) — not the full payload duplicated in Postgres.

**Logging:** The app does not `console.log` match contents on success. `console.error` runs only if an upload or DB insert fails (useful in DevTools when debugging).

---

## Enabling match sharing (checklist)

Do these in order to turn the feature on for production (or Preview):

1. **Supabase project** — Create a project at [supabase.com](https://supabase.com) if you do not have one.
2. **Database + storage** — In SQL Editor, run **`supabase/RUN_ALL_IN_SQL_EDITOR.sql`** (or migrations `001` then `002` in order). This creates `match_submissions`, the private `match-uploads` bucket, and RLS policies.
3. **Site URL / CORS** — Supabase → **Authentication** → **URL Configuration**: add your live site URL (e.g. `https://your-app.vercel.app`) and `http://localhost:5173` for local dev. Fix CORS errors if the browser blocks Storage.
4. **Vercel env vars** — Project → **Settings** → **Environment Variables**:
   - `VITE_SUPABASE_URL` = Project URL (Settings → API)
   - `VITE_SUPABASE_ANON_KEY` = **anon** public key (same screen)  
   Apply to **Production** and **Preview** if you want sharing on preview deploys too.
5. **Redeploy** — Run a new deployment so the build picks up `VITE_*` values.
6. **Verify** — Open the site, confirm the share checkbox appears, check a box, upload a zip, then confirm Storage + `match_submissions` in Supabase (see checklist below).

Skip steps 2–6 if you only want a fully local tool with no uploads.

## Vercel (hosting)

1. Import the Git repository and set **Root Directory** to `prosperity-viz` (the repo root is one level above this folder).
2. Framework: **Vite**, or leave auto-detect if Vercel picks it up.
3. **Build Command:** `npm run build`
4. **Output Directory:** `dist`
5. **Environment variables** — See **Enabling match sharing** above. If `VITE_SUPABASE_*` are unset, the app still works; the share checkbox is **hidden** and nothing is uploaded.

## Supabase reference (schema)

1. **Bucket:** `match-uploads` (50 MB per object by default; raise in Dashboard → Storage → Configuration if needed).
2. **Row Level Security:** INSERT-only for `anon` / `authenticated` on `match_submissions` and INSERT-only on `storage.objects` for paths `matches/*/original.zip` and `matches/*/parsed.json`. There is **no** public read; inspect data in the Dashboard with elevated access.
3. **MCP / CLI:** You can apply the same SQL via Supabase MCP (`apply_migration` / SQL) or paste `RUN_ALL_IN_SQL_EDITOR.sql` in the SQL Editor.

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
