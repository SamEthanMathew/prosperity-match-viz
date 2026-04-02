# Prosperity IV — Match Visualizer

Browser-based replay and analysis for **Prosperity IV** match exports. Load a match `.zip`, explore equity curves, product replay, trades, and optional advanced tabs — all in the client (no upload required unless you opt in).

**Repository:** [github.com/SamEthanMathew/prosperity-match-viz](https://github.com/SamEthanMathew/prosperity-match-viz)

If you find this project useful, **[star the repo on GitHub](https://github.com/SamEthanMathew/prosperity-match-viz)** — it helps visibility and signals that the tool is worth maintaining.

---

## Project layout

| Path | Purpose |
|------|---------|
| [`prosperity-viz/`](./prosperity-viz/) | Vite + React + TypeScript app (this is what you deploy) |
| [`prosperity-viz/supabase/`](./prosperity-viz/supabase/) | SQL for optional Supabase sharing (bucket + `match_submissions`) |
| [`prosperity-viz/DEPLOY.md`](./prosperity-viz/DEPLOY.md) | Hosting (Vercel), env vars, Supabase checklist |

---

## Quick start (local)

```bash
cd prosperity-viz
cp .env.example .env.local
# Optional: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY for “share match”
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`), then drop a match `.zip` on the upload area.

---

## Hosting

The UI is a static build (`npm run build` → `dist`). See **[DEPLOY.md](./prosperity-viz/DEPLOY.md)** for Vercel (recommended), environment variables, and Supabase URL configuration.

---

## Optional: Supabase

Sharing a match copy to your own Supabase project is **optional**. Schema and storage policies live in:

- `prosperity-viz/supabase/RUN_ALL_IN_SQL_EDITOR.sql` (single paste in the SQL Editor), or  
- ordered migrations under `prosperity-viz/supabase/migrations/`

Details: [DEPLOY.md § Supabase setup](./prosperity-viz/DEPLOY.md#supabase-setup).

---

## Contributing

See **[CONTRIBUTING.md](./CONTRIBUTING.md)** for setup, PR expectations, and how to configure local editor tooling without committing it.

## Security

See **[SECURITY.md](./SECURITY.md)** for how to report vulnerabilities responsibly.

## License

This project is licensed under the **MIT License** — see [LICENSE](./LICENSE).

If the app saved you time, a **[GitHub star](https://github.com/SamEthanMathew/prosperity-match-viz)** is appreciated.
