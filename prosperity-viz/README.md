# Prosperity IV — Match Visualizer (web app)

Vite + React + TypeScript client for exploring Prosperity IV match `.zip` exports (charts, replay, ledger, optional simple mode).

## Docs & repo

- **Full overview, hosting, and Supabase:** see the [repository README](../README.md) and [DEPLOY.md](./DEPLOY.md).
- **Contributing:** [CONTRIBUTING.md](../CONTRIBUTING.md)
- **Star on GitHub:** [SamEthanMathew/prosperity-match-viz](https://github.com/SamEthanMathew/prosperity-match-viz) — appreciated if the tool is useful to you.

## Develop

```bash
npm install
cp .env.example .env.local   # optional Supabase keys; optional VITE_BACKTEST_API_URL for remote backtest API
npm run dev
```

**Backtest page:** with [`backtest-api`](../backtest-api/) running locally (port 8787), open `/backtest` to upload a `Trader` `.py` file. See the [repository README](../README.md#backtesting-in-the-ui-backtest) for full setup and security notes.

**Trade history:** Some logs (including Rust backtester output) interleave **market tape** prints with **your** fills. Rows where neither `buyer` nor `seller` is `SUBMISSION` are third-party trades. The UI classifies `SUBMISSION` as buyer vs seller for your fills only; ledger, PnL-by-fill, and main chart markers use **your fills**. The microscope mini-chart can still show tape points as neutral “Tape” markers for context.

```bash
npm run build   # output: dist/
npm run lint
```

## Structure (high level)

- `src/components/` — layout, charts, upload, tabs  
- `src/store/useReplayStore.ts` — loaded match state  
- `src/parsing/` — zip / match parsing  
- `supabase/` — optional backend SQL for shared uploads  
