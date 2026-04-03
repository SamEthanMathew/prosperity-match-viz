import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { parseZipFile } from '../parsing/parseZip';
import { useReplayStore } from '../store/useReplayStore';

const DATASETS: { value: string; label: string }[] = [
  { value: 'tutorial', label: 'Tutorial (full folder)' },
  { value: 'tutorial-d-1', label: 'Tutorial day -1 (single CSV)' },
  { value: 'tutorial-d-2', label: 'Tutorial day -2 (single CSV)' },
  { value: 'latest', label: 'Latest populated round (round8→…→tutorial)' },
  { value: 'round1', label: 'Round 1' },
  { value: 'round2', label: 'Round 2' },
  { value: 'round3', label: 'Round 3' },
  { value: 'round4', label: 'Round 4' },
  { value: 'round5', label: 'Round 5' },
  { value: 'round6', label: 'Round 6' },
  { value: 'round7', label: 'Round 7' },
  { value: 'round8', label: 'Round 8' },
];

function backtestEndpoint(): string {
  const base = import.meta.env.VITE_BACKTEST_API_URL?.trim() || '';
  if (!base) return '/api/backtest';
  return `${base.replace(/\/$/, '')}/api/backtest`;
}

export function BacktestPage() {
  const navigate = useNavigate();
  const loadData = useReplayStore((s) => s.loadData);

  const [file, setFile] = useState<File | null>(null);
  const [traderWarning, setTraderWarning] = useState<string | null>(null);
  const [dataset, setDataset] = useState('tutorial-d-1');
  const [day, setDay] = useState('');
  const [carry, setCarry] = useState(false);
  const [tradeMatchMode, setTradeMatchMode] = useState('all');
  const [queuePenetration, setQueuePenetration] = useState('1');
  const [priceSlippageBps, setPriceSlippageBps] = useState('0');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onFile = useCallback(async (f: File | null) => {
    setFile(f);
    setTraderWarning(null);
    if (!f) return;
    if (!f.name.toLowerCase().endsWith('.py')) {
      setTraderWarning('Please choose a .py file.');
      return;
    }
    const text = await f.text();
    if (!/\bclass\s+Trader\b/.test(text)) {
      setTraderWarning('No "class Trader" found — file should define a Trader class for the Rust backtester.');
    }
  }, []);

  const runBacktest = async () => {
    setError(null);
    if (!file) {
      setError('Select a trader Python file.');
      return;
    }
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('trader', file);
      fd.append('dataset', dataset);
      if (day.trim() !== '') fd.append('day', day.trim());
      if (carry) fd.append('carry', '1');
      fd.append('tradeMatchMode', tradeMatchMode);
      fd.append('queuePenetration', queuePenetration);
      fd.append('priceSlippageBps', priceSlippageBps);

      const res = await fetch(backtestEndpoint(), {
        method: 'POST',
        body: fd,
      });

      if (!res.ok) {
        const ct = res.headers.get('content-type') || '';
        if (ct.includes('application/json')) {
          const j = (await res.json()) as { error?: string };
          throw new Error(j.error || `Request failed (${res.status})`);
        }
        throw new Error((await res.text()) || `Request failed (${res.status})`);
      }

      const blob = await res.blob();
      const zipFile = new File([blob], 'backtest.zip', { type: 'application/zip' });
      const data = await parseZipFile(zipFile);
      loadData(data);
      navigate('/');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        boxSizing: 'border-box',
        width: '100%',
        maxWidth: 680,
        margin: '0 auto',
        minHeight: '100%',
        background: '#1e1e2e',
        color: '#cdd6f4',
        padding: '24px 20px 48px',
      }}
    >
      <h1 style={{ fontSize: 22, color: '#89b4fa', margin: '0 0 8px' }}>
        Run backtest
      </h1>
      <p style={{ fontSize: 13, color: '#7f849c', lineHeight: 1.5, marginBottom: 24 }}>
        Upload a Python file that defines <code style={{ color: '#89dceb' }}>class Trader</code>
        {' '}compatible with the{' '}
        <a
          href="https://github.com/GeyzsoN/prosperity_rust_backtester"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: '#89b4fa' }}
        >
          Rust backtester
        </a>
        . The API runs <code style={{ color: '#89dceb' }}>rust_backtester</code> locally or on your
        configured host; arbitrary code executes on that machine.
      </p>

      <label style={{ display: 'block', fontSize: 12, color: '#a6adc8', marginBottom: 6 }}>
        Trader (.py)
      </label>
      <input
        type="file"
        accept=".py,text/x-python,application/x-python-code"
        disabled={loading}
        onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
        style={{ marginBottom: 8, fontSize: 13, color: '#cdd6f4' }}
      />
      {traderWarning && (
        <div style={{ fontSize: 12, color: '#fab387', marginBottom: 12 }}>{traderWarning}</div>
      )}

      <label style={{ display: 'block', fontSize: 12, color: '#a6adc8', marginBottom: 6 }}>
        Dataset
      </label>
      <select
        value={dataset}
        disabled={loading}
        onChange={(e) => setDataset(e.target.value)}
        style={{
          width: '100%',
          padding: '8px 10px',
          marginBottom: 16,
          background: '#313244',
          border: '1px solid #45475a',
          borderRadius: 6,
          color: '#cdd6f4',
          fontSize: 13,
        }}
      >
        {DATASETS.map((d) => (
          <option key={d.value} value={d.value}>
            {d.label}
          </option>
        ))}
      </select>

      <button
        type="button"
        onClick={() => setShowAdvanced((v) => !v)}
        style={{
          background: 'transparent',
          border: 'none',
          color: '#89b4fa',
          cursor: 'pointer',
          fontSize: 12,
          marginBottom: 12,
          padding: 0,
        }}
      >
        {showAdvanced ? 'Hide advanced' : 'Advanced matching options'}
      </button>

      {showAdvanced && (
        <div
          style={{
            display: 'grid',
            gap: 12,
            marginBottom: 16,
            padding: 12,
            background: '#181825',
            borderRadius: 8,
            border: '1px solid #313244',
          }}
        >
          <div>
            <label style={{ fontSize: 11, color: '#7f849c' }}>Day (optional, integer)</label>
            <input
              value={day}
              onChange={(e) => setDay(e.target.value)}
              placeholder="e.g. -1"
              disabled={loading}
              style={{
                width: '100%',
                marginTop: 4,
                padding: '6px 8px',
                background: '#313244',
                border: '1px solid #45475a',
                borderRadius: 4,
                color: '#cdd6f4',
                fontSize: 12,
              }}
            />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
            <input
              type="checkbox"
              checked={carry}
              disabled={loading}
              onChange={(e) => setCarry(e.target.checked)}
            />
            Carry state across days (Rust --carry)
          </label>
          <div>
            <label style={{ fontSize: 11, color: '#7f849c' }}>trade-match-mode</label>
            <input
              value={tradeMatchMode}
              onChange={(e) => setTradeMatchMode(e.target.value)}
              disabled={loading}
              style={{
                width: '100%',
                marginTop: 4,
                padding: '6px 8px',
                background: '#313244',
                border: '1px solid #45475a',
                borderRadius: 4,
                color: '#cdd6f4',
                fontSize: 12,
              }}
            />
          </div>
          <div>
            <label style={{ fontSize: 11, color: '#7f849c' }}>queue-penetration</label>
            <input
              value={queuePenetration}
              onChange={(e) => setQueuePenetration(e.target.value)}
              disabled={loading}
              style={{
                width: '100%',
                marginTop: 4,
                padding: '6px 8px',
                background: '#313244',
                border: '1px solid #45475a',
                borderRadius: 4,
                color: '#cdd6f4',
                fontSize: 12,
              }}
            />
          </div>
          <div>
            <label style={{ fontSize: 11, color: '#7f849c' }}>price-slippage-bps</label>
            <input
              value={priceSlippageBps}
              onChange={(e) => setPriceSlippageBps(e.target.value)}
              disabled={loading}
              style={{
                width: '100%',
                marginTop: 4,
                padding: '6px 8px',
                background: '#313244',
                border: '1px solid #45475a',
                borderRadius: 4,
                color: '#cdd6f4',
                fontSize: 12,
              }}
            />
          </div>
        </div>
      )}

      {error && (
        <div
          style={{
            color: '#f38ba8',
            background: '#f38ba822',
            border: '1px solid #f38ba844',
            borderRadius: 6,
            padding: '10px 12px',
            fontSize: 12,
            marginBottom: 16,
            whiteSpace: 'pre-wrap',
          }}
        >
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={() => void runBacktest()}
        disabled={loading || !file}
        style={{
          padding: '10px 20px',
          fontSize: 14,
          fontWeight: 'bold',
          borderRadius: 6,
          border: '1px solid #89b4fa',
          background: loading ? '#313244' : '#89b4fa33',
          color: '#89b4fa',
          cursor: loading || !file ? 'not-allowed' : 'pointer',
          width: '100%',
        }}
      >
        {loading ? 'Running backtest…' : 'Run backtest & open replay'}
      </button>

      <p style={{ fontSize: 11, color: '#6c7086', marginTop: 20, lineHeight: 1.5 }}>
        Local dev: start{' '}
        <code style={{ color: '#89dceb' }}>backtest-api</code> on port 8787 and{' '}
        <code style={{ color: '#89dceb' }}>npm run dev</code> for the Vite proxy. For production,
        set <code style={{ color: '#89dceb' }}>VITE_BACKTEST_API_URL</code> to your API origin.
      </p>
    </div>
  );
}
