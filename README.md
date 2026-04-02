# Prosperity IV — Match Visualizer

Browser-based replay and analysis for **Prosperity IV** match exports. Load a match `.zip`, explore equity curves, product replay, trades, and optional advanced tabs — all processed in your browser.

**Repository:** [github.com/SamEthanMathew/prosperity-match-viz](https://github.com/SamEthanMathew/prosperity-match-viz)

If you find this project useful, **[star the repo on GitHub](https://github.com/SamEthanMathew/prosperity-match-viz)** — it helps visibility and signals that the tool is worth maintaining.

---

## Project layout

| Path | Purpose |
|------|---------|
| [`prosperity-viz/`](./prosperity-viz/) | Vite + React + TypeScript app (this is what you deploy) |
| [`prosperity-viz/DEPLOY.md`](./prosperity-viz/DEPLOY.md) | Hosting (e.g. Vercel) and deployment notes |

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
