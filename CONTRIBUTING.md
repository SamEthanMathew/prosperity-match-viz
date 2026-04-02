# Contributing

Thanks for helping improve the Prosperity IV Match Visualizer.

## Getting started

1. Fork the repo and clone your fork.
2. Install and run the app:

   ```bash
   cd prosperity-viz
   npm install
   cp .env.example .env.local
   npm run dev
   ```

3. Optional: set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env.local` only if you are working on the optional “share match” upload flow. Never commit real keys.

## Before you open a PR

- Run **`npm run lint`** and **`npm run build`** from `prosperity-viz/` and fix any issues.
- Keep changes focused on one concern (feature, fix, or docs) when possible.
- If you change user-visible behavior, mention it in the PR description.

## Project structure

- `prosperity-viz/src/` — React app (components, store, parsing, lib).
- `prosperity-viz/supabase/` — SQL for optional Supabase (run in your own project, not committed secrets).

## Editor tooling (local only)

Folders like **`.cursor/`** and **`.claude/`** are **gitignored**. They may contain personal MCP URLs, project refs, or machine-specific settings — do not force-add them.

If you use **Cursor** with the hosted Supabase MCP, copy [`editor/cursor-mcp.json.example`](./editor/cursor-mcp.json.example) to **`.cursor/mcp.json`** in your clone and replace `YOUR_SUPABASE_PROJECT_REF` with your own ref.

## Questions

Open a [GitHub issue](https://github.com/SamEthanMathew/prosperity-match-viz/issues) for bugs or design discussion before large refactors.
