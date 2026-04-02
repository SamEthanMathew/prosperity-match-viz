import type { ReactNode } from 'react';

const h2: React.CSSProperties = {
  color: '#89b4fa',
  fontSize: 13,
  fontWeight: 'bold',
  margin: '16px 0 8px',
};
const p: React.CSSProperties = {
  color: '#cdd6f4',
  fontSize: 12,
  lineHeight: 1.55,
  margin: '0 0 10px',
};
const muted: React.CSSProperties = {
  ...p,
  color: '#7f849c',
};
const ul: React.CSSProperties = {
  color: '#cdd6f4',
  fontSize: 12,
  lineHeight: 1.55,
  margin: '0 0 10px',
  paddingLeft: 18,
};

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 style={h2}>{title}</h2>
      {children}
    </section>
  );
}

/** Full user guide body for the help modal (inline styles match app palette). */
export function GuideContent() {
  return (
    <>
      <Section title="What this app does">
        <p style={p}>
          The ProsperityIV Match Visualizer turns your exported match archive into interactive charts and tables so you can see PnL over time, how the bot traded, book state, and decision modes along a shared time cursor.
        </p>
      </Section>

      <Section title="Uploading your match">
        <p style={p}>
          Use a <strong style={{ color: '#cdd6f4' }}>.zip</strong> file that contains exactly <strong style={{ color: '#cdd6f4' }}>one</strong> <code style={{ color: '#89dceb' }}>.json</code> and <strong style={{ color: '#cdd6f4' }}>one</strong>{' '}
          <code style={{ color: '#89dceb' }}>.log</code> at the <strong style={{ color: '#cdd6f4' }}>root</strong> of the zip (not inside subfolders). The JSON holds match metadata plus the activities log and graph log strings; the log file holds sandbox/lambda entries and trade history. If parsing fails, check that both files are present and the export matches ProsperityIV&apos;s format.
        </p>
        <p style={p}>
          If your host has enabled analytics storage, you may see an optional checkbox to <strong style={{ color: '#cdd6f4' }}>share</strong> the original zip and a full parsed snapshot of the match. Nothing is uploaded unless you check it. The visualizer still works fully if you decline or if sharing fails.
        </p>
      </Section>

      <Section title="Time cursor (the heart of navigation)">
        <p style={p}>
          Almost everything revolves around the <strong style={{ color: '#f9e2af' }}>current timestamp</strong> (shown in the toolbar in Expert view as <code style={{ color: '#89dceb' }}>ts=…</code>). That moment in the match drives:
        </p>
        <ul style={ul}>
          <li>Vertical cursor lines on the main charts</li>
          <li>The <strong style={{ color: '#cdd6f4' }}>Microscope</strong> panel: nearest order-book snapshot and bot state for each product at that time</li>
          <li>Which row is highlighted in the <strong style={{ color: '#cdd6f4' }}>Trade ledger</strong> (fills within a small window of that time)</li>
        </ul>
        <p style={p}>
          You can move the cursor by: <strong style={{ color: '#cdd6f4' }}>clicking</strong> a point on charts that support it, <strong style={{ color: '#cdd6f4' }}>clicking</strong> a trade row, <strong style={{ color: '#cdd6f4' }}>clicking</strong> a bookmark, using toolbar <strong style={{ color: '#cdd6f4' }}>fill / mode</strong> navigation or <strong style={{ color: '#cdd6f4' }}>Jump</strong>, using <strong style={{ color: '#cdd6f4' }}>keyboard</strong> shortcuts (after load), or interactive elements in <strong style={{ color: '#cdd6f4' }}>Simple view</strong> where provided.
        </p>
      </Section>

      <Section title="Opening this guide">
        <p style={p}>
          Click <strong style={{ color: '#cdd6f4' }}>How to use</strong> on the upload screen before you load a file, or in the top toolbar after a match is loaded. Close the panel with the Close button or by clicking the dimmed backdrop outside the panel.
        </p>
      </Section>

      <Section title="Toolbar (after load)">
        <ul style={ul}>
          <li>
            <strong style={{ color: '#cdd6f4' }}>Simple / Expert</strong> — Simple view hides the tab bar and shows a plain-language summary and selected charts; Expert view shows the full multi-panel layout and analysis tabs.
          </li>
          <li>
            <strong style={{ color: '#cdd6f4' }}>Round and status</strong> — Match identifier from your export.
          </li>
          <li>
            <strong style={{ color: '#cdd6f4' }}>Final profit</strong> — End-of-match profit from metadata.
          </li>
          <li>
            <strong style={{ color: '#cdd6f4' }}>Per-product numbers</strong> — Cumulative <em>realized</em> cash PnL from trades for each product, evaluated at the current cursor time.
          </li>
          <li>
            <strong style={{ color: '#cdd6f4' }}>PnL@cursor</strong> — Total PnL from the equity curve at the cursor (same timeline as the equity chart).
          </li>
          <li>
            <strong style={{ color: '#cdd6f4' }}>fills</strong> — How many trades have occurred up to the cursor vs total trades in the match.
          </li>
          <li>
            <strong style={{ color: '#cdd6f4' }}>Expert only:</strong> <em>← fill / fill →</em> and <em>← mode / mode →</em> jump the cursor to the previous or next trade time, or the previous or next bot mode change. <em>Jump</em> moves to a timestamp you type (clamped to a safe range in the app). <em>Reset</em> clears the match so you can upload another zip.
          </li>
        </ul>
      </Section>

      <Section title="Keyboard shortcuts">
        <p style={p}>
          After a match is loaded, with focus <strong style={{ color: '#cdd6f4' }}>not</strong> inside a text field:
        </p>
        <ul style={ul}>
          <li>
            <strong style={{ color: '#cdd6f4' }}>Left / Right arrow</strong> — Previous / next trade (same as toolbar fill navigation).
          </li>
          <li>
            <strong style={{ color: '#cdd6f4' }}>Shift + Left / Right</strong> — Previous / next mode switch.
          </li>
        </ul>
        <p style={muted}>Full behavior details for each screen are below; you can also keep the short reminder on the upload screen in mind.</p>
      </Section>

      <Section title="Expert view — Main tab">
        <p style={p}>
          A <strong style={{ color: '#cdd6f4' }}>2×2 grid</strong> plus a <strong style={{ color: '#cdd6f4' }}>Bookmarks</strong> sidebar:
        </p>
        <ul style={ul}>
          <li>
            <strong style={{ color: '#cdd6f4' }}>Equity &amp; PnL timeline</strong> — Total PnL, per-product realized series, buy/sell markers, and annotations for notable events. Click the chart to set the cursor. Panning and zooming the horizontal axis stays in sync with the Product replay chart where linked.
          </li>
          <li>
            <strong style={{ color: '#cdd6f4' }}>Product replay</strong> — Pick <strong style={{ color: '#cdd6f4' }}>EMERALDS</strong> or <strong style={{ color: '#cdd6f4' }}>TOMATOES</strong>. Shows mid price, fair value, optional EWMA when logged, best bid/ask, trade markers, inventory bars, mode-change markers, and position cap reference lines. Click to set the cursor.
          </li>
          <li>
            <strong style={{ color: '#cdd6f4' }}>Microscope</strong> — For each product, the order book at the cursor (nearest tick), bot mode, inventory vs cap, fair price, imbalance, and optional fields (skew, EWMA, mid delta) when present. Lists fills very close to the cursor with forward-looking outcome columns where shown.
          </li>
          <li>
            <strong style={{ color: '#cdd6f4' }}>Trade ledger</strong> — All fills with filters and forward metrics (see next section).
          </li>
        </ul>
      </Section>

      <Section title="Trade ledger">
        <p style={p}>
          Virtualized table of every fill with outcomes computed vs the book. <strong style={{ color: '#cdd6f4' }}>Filters:</strong> product (or all), direction buy/sell/all, &quot;bookmarked only&quot;, and <em>→ next from ts</em> to jump the cursor to the next visible trade at or after the current time (and select that product).
        </p>
        <p style={p}>
          <strong style={{ color: '#cdd6f4' }}>Columns (short labels):</strong> timestamp, symbol, buy/sell, price, quantity, spread at fill, <strong style={{ color: '#cdd6f4' }}>f500</strong> / <strong style={{ color: '#cdd6f4' }}>f5k</strong> — forward PnL vs mid a few hundred ms and several seconds after the fill; <strong style={{ color: '#cdd6f4' }}>adv500</strong> — adverse-selection style read on the short horizon. Click a row to move the cursor to that fill and focus that product. The <strong style={{ color: '#cdd6f4' }}>flag</strong> column adds a manual bookmark at that trade time (or removes one when toggling off where the app supports it).
        </p>
      </Section>

      <Section title="Bookmarks">
        <p style={p}>
          The sidebar lists <strong style={{ color: '#cdd6f4' }}>automatic</strong> bookmarks such as: maximum drawdown, peak PnL, inventory near position cap, notable switches into aggressive (taker) modes, and large fills. <strong style={{ color: '#cdd6f4' }}>Manual</strong> bookmarks appear when you flag a trade in the ledger; use the ✕ on a manual entry to remove it. Click any bookmark to jump the cursor to that time.
        </p>
      </Section>

      <Section title="Other tabs (Expert)">
        <ul style={ul}>
          <li>
            <strong style={{ color: '#cdd6f4' }}>Modes</strong> — How often the bot spent in each mode, mode transitions, and rough attribution of realized trade cash flows to the mode active at each fill. Click supported charts to move the cursor.
          </li>
          <li>
            <strong style={{ color: '#cdd6f4' }}>Inventory</strong> — Inventory over time per product and distribution views; final positions from the match summary where shown. Click supported charts to seek in time.
          </li>
          <li>
            <strong style={{ color: '#cdd6f4' }}>Signals</strong> — Book imbalance over time; for tomatoes, EWMA vs mid when those fields exist in the logs. Click supported charts to seek in time.
          </li>
        </ul>
      </Section>

      <Section title="Simple view">
        <p style={p}>
          A more approachable layout: scorecards for profit, trade counts, duration, and ending inventory; short plain-English descriptions of what each bot mode means; and charts or cards that still respect the same time cursor where interactive. Use it when you want the story of the match without the full four-panel grid.
        </p>
      </Section>
    </>
  );
}
