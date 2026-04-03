import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GITHUB_REPO_URL } from '../lib/repoMeta';

const tools = [
  {
    icon: '📊',
    title: 'Match Visualizer',
    path: '/visualizer',
    tagline: 'Replay and analyse your competition match logs',
    description:
      'Drop in the .zip file from any ProsperityIV match. Get an interactive equity curve, price replay, order-book snapshots, and a full trade ledger — all locked to a shared time cursor.',
    howItWorks: [
      'Everything runs entirely in your browser — no account, no uploads, no setup.',
      'Drop the .zip you downloaded from the Prosperity portal onto the drop zone. The file is parsed locally and never leaves your machine.',
      'Choose Simple view for a plain-language scorecard of each product, or Expert view for the full 4-panel grid (equity curve, price replay, order-book depth, and trade ledger).',
      'Once loaded, use ← / → to step through individual fills one at a time. Shift+← / Shift+→ jumps between strategy mode-change events. The price chart and order book stay in sync with the cursor.',
    ],
    hint: 'Accepts .zip files · runs entirely in your browser',
    color: '#a6e3a1',
  },
  {
    icon: '⚡',
    title: 'Backtester',
    path: '/backtest',
    tagline: 'Run your trader against historical data',
    description:
      'Upload your trader.py and pick a round dataset. The backtester runs your bot against real historical market data and returns a full match replay you can explore in the Visualizer.',
    howItWorks: [
      'The backtester executes Python on your machine, so it requires the companion API server to be running locally alongside this page. See the GitHub README for the one-time setup — it\'s a single command once the dependencies are installed.',
      'Once the server is up, upload your trader.py, choose a dataset (Tutorial or Rounds 1–8), and optionally adjust queue penetration and slippage to match how aggressively you want fills modelled.',
      'Click Run. The server replays your bot against the full historical order book tick-by-tick. When it finishes, the result loads automatically in the Visualizer so you can inspect every fill.',
      'Tip: start with the Tutorial dataset to verify your bot runs without errors before trying a full round.',
    ],
    hint: 'Accepts .py files · requires the local API server',
    color: '#f9e2af',
  },
  {
    icon: '🎲',
    title: 'Monte Carlo',
    path: '/montecarlo',
    tagline: 'Stress-test your strategy across hundreds of scenarios',
    description:
      'Upload your trader.py and run hundreds of simulations with randomised execution parameters. See how your PnL distributes across market conditions, your Sharpe ratio, VaR, and tail risk.',
    howItWorks: [
      'Like the Backtester, this runs on your machine and requires the companion API server. See the GitHub README for setup.',
      'Each simulation independently randomises queue penetration (how readily the market fills your passive orders) and hazard strength (how volatile execution noise is). This turns a single backtest number into a continuous distribution that reflects real execution uncertainty.',
      'Pick Quick (≈100 sessions) for a fast sanity check, or Heavy (≈500+ sessions) for tighter confidence bands. Results appear as a PnL histogram, per-product quantile bands, a Sharpe ratio, VaR, and a sortable session table.',
      'A wide distribution means your strategy\'s outcome is highly sensitive to execution luck. A tight distribution means the edge is robust.',
    ],
    hint: 'Accepts .py files · requires the local API server',
    color: '#cba6f7',
  },
];

function ToolCard({ tool }: { tool: (typeof tools)[0] }) {
  const [expanded, setExpanded] = useState(false);
  const [hovered, setHovered] = useState(false);
  const navigate = useNavigate();

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: '#181825',
        border: `1px solid ${hovered ? '#45475a' : '#313244'}`,
        borderRadius: 10,
        padding: 20,
        width: 300,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        transition: 'border-color 0.15s',
        flexShrink: 0,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 22 }}>{tool.icon}</span>
        <span style={{ color: '#cdd6f4', fontSize: 14, fontWeight: 'bold' }}>{tool.title}</span>
      </div>

      {/* Tagline */}
      <div style={{ color: tool.color, fontSize: 11, lineHeight: 1.4 }}>{tool.tagline}</div>

      <div style={{ borderTop: '1px solid #313244', margin: '0 -4px' }} />

      {/* Description */}
      <div style={{ color: '#7f849c', fontSize: 12, lineHeight: 1.6, flex: 1 }}>
        {tool.description}
      </div>

      {/* How it works toggle */}
      <div>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          style={{
            background: 'none',
            border: 'none',
            color: '#6c7086',
            fontSize: 11,
            cursor: 'pointer',
            padding: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          How it works {expanded ? '▴' : '▾'}
        </button>
        <div
          style={{
            maxHeight: expanded ? 600 : 0,
            overflow: 'hidden',
            transition: 'max-height 0.2s ease',
          }}
        >
          <div
            style={{
              color: '#585b70',
              fontSize: 11,
              lineHeight: 1.6,
              paddingTop: 8,
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            {tool.howItWorks.map((para, i) => (
              <p key={i} style={{ margin: 0 }}>{para}</p>
            ))}
          </div>
        </div>
      </div>

      <div style={{ borderTop: '1px solid #313244', margin: '0 -4px' }} />

      {/* Hint */}
      <div style={{ color: '#45475a', fontSize: 10 }}>{tool.hint}</div>

      {/* CTA */}
      <button
        type="button"
        onClick={() => navigate(tool.path)}
        style={{
          background: '#89b4fa22',
          border: '1px solid #89b4fa',
          color: '#89b4fa',
          borderRadius: 6,
          padding: '7px 14px',
          fontSize: 12,
          cursor: 'pointer',
          width: '100%',
          fontFamily: 'inherit',
        }}
      >
        Open tool →
      </button>
    </div>
  );
}

export function HomePage() {
  const openHelp = useReplayStore((s) => s.openHelp);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: '#11111b',
        padding: '40px 20px',
        gap: 40,
        boxSizing: 'border-box',
      }}
    >
      {/* Header */}
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            color: '#89b4fa',
            fontSize: 26,
            fontWeight: 'bold',
            marginBottom: 8,
            letterSpacing: '-0.5px',
          }}
        >
          ProsperityIV Tools Hub
        </div>
        <div style={{ color: '#7f849c', fontSize: 13 }}>
          Your toolkit for the IMC Prosperity IV trading competition.
        </div>
      </div>

      {/* Tool cards */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 20,
          justifyContent: 'center',
          maxWidth: 980,
        }}
      >
        {tools.map((tool) => (
          <ToolCard key={tool.path} tool={tool} />
        ))}
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginTop: 8 }}>
        <a
          href={GITHUB_REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: '#6c7086',
            fontSize: 11,
            textDecoration: 'none',
          }}
        >
          GitHub repo ↗
        </a>
        <span style={{ color: '#313244' }}>|</span>
        <button
          type="button"
          onClick={openHelp}
          style={{
            background: 'none',
            border: 'none',
            color: '#6c7086',
            fontSize: 11,
            cursor: 'pointer',
            padding: 0,
            fontFamily: 'inherit',
          }}
        >
          How to use →
        </button>
      </div>
    </div>
  );
}
