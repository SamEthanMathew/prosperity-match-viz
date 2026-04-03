# Prosperity IV — Match Visualizer

Browser-based replay and analysis for **Prosperity IV** match exports. Load a match `.zip`, explore equity curves, product replay, trades, and optional advanced tabs — all processed in your browser.

**Website:** [prosperity-match-viz.vercel.app](prosperity-match-viz.vercel.app)

If you find this project useful, **[star the repo on GitHub](https://github.com/SamEthanMathew/prosperity-match-viz)** — it helps visibility and signals that the tool is worth maintaining.

---

## Project layout

| Path | Purpose |
|------|---------|
| [`prosperity-viz/`](./prosperity-viz/) | Vite + React + TypeScript app (this is what you deploy) |
| [`backtest-api/`](./backtest-api/) | Optional Node server: runs [rust_backtester](https://github.com/GeyzsoN/prosperity_rust_backtester) and returns a match zip for the UI |
| Root [`package.json`](./package.json) | Optional: `npm run dev:backtest-ui` starts API + Vite together (see backtesting section) |
| [`prosperity-viz/DEPLOY.md`](./prosperity-viz/DEPLOY.md) | Hosting (e.g. Vercel) and deployment notes |

---

## Backtesting in the UI (`/backtest`)

The visualizer can run a **Python `Trader`** against local datasets via the **Rust IMC backtester**. This is **not** available on a plain static deploy: you need the `backtest-api` service plus a built `rust_backtester` binary and a `datasets/` tree (same layout as the backtester repo).

**Security:** uploading a trader file executes arbitrary Python on the machine running `backtest-api`. Only expose this API to trusted users or run it on localhost.

### One-time setup

1. Build `rust_backtester` from [prosperity_rust_backtester](https://github.com/GeyzsoN/prosperity_rust_backtester) (e.g. `cargo build --release`; note the path to `target/release/rust_backtester`).
2. Have a `datasets/` directory (e.g. copy or symlink `prosperity_rust_backtester/datasets`).

### Local dev (API + UI)

**One command (from repository root):** after one-time `npm install` in `backtest-api/`, `prosperity-viz/`, and at the repo root:

```bash
npm install
npm run dev:backtest-ui
```

Then open `http://localhost:5173/backtest`. Vite proxies `/api/*` to `http://127.0.0.1:8787` by default.

To start the same processes and **open the backtest page in your browser** (macOS `open`, Windows `start`, Linux `xdg-open`):

```bash
npm run dev:backtest-ui:open
```

**Manual (two terminals):**

```bash
cd backtest-api
cp .env.example .env
# Edit .env: RUST_BACKTESTER_BIN, BACKTEST_DATASETS_ROOT (on macOS, set PYTHON_BIN for PyO3 — see backtest-api/.env.example)
npm install
npm start
```

```bash
cd prosperity-viz
npm install
npm run dev
```

### Production / remote UI

- Host `backtest-api` on a server with Rust + Python available; set `BACKTEST_CORS_ORIGIN=*` if the UI is on another origin (see `backtest-api/.env.example`).
- Build the static app with `VITE_BACKTEST_API_URL=https://your-api.example.com` so the browser calls your API directly (no proxy).

---

## Quick start (local)

```bash
cd prosperity-viz
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`), then drop a match `.zip` on the upload area.

---

## Hosting

The UI is a static build (`npm run build` → `dist`). See **[DEPLOY.md](./prosperity-viz/DEPLOY.md)** for deployment options and configuration.

---

## Contributing

See **[CONTRIBUTING.md](./CONTRIBUTING.md)** for setup, PR expectations, and how to configure local editor tooling without committing it.

## Security

See **[SECURITY.md](./SECURITY.md)** for how to report vulnerabilities responsibly.

## License

This project is licensed under the **MIT License** — see [LICENSE](./LICENSE).

If the app saved you time, a **[GitHub star](https://github.com/SamEthanMathew/prosperity-match-viz)** is appreciated.
