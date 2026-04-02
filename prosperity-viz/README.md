# Prosperity IV — Match Visualizer (web app)

Vite + React + TypeScript client for exploring Prosperity IV match `.zip` exports (charts, replay, ledger, optional simple mode).

## Docs & repo

- **Full overview, hosting, and Supabase:** see the [repository README](../README.md) and [DEPLOY.md](./DEPLOY.md).
- **Contributing:** [CONTRIBUTING.md](../CONTRIBUTING.md)
- **Star on GitHub:** [SamEthanMathew/prosperity-match-viz](https://github.com/SamEthanMathew/prosperity-match-viz) — appreciated if the tool is useful to you.

## Develop

```bash
npm install
cp .env.example .env.local   # optional Supabase keys for “share match”
npm run dev
```

```bash
npm run build   # output: dist/
npm run lint
```

## Structure (high level)

- `src/components/` — layout, charts, upload, tabs  
- `src/store/useReplayStore.ts` — loaded match state  
- `src/parsing/` — zip / match parsing  
- `supabase/` — optional backend SQL for shared uploads  
