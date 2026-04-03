import { Link } from 'react-router-dom';
import { useReplayStore } from '../../store/useReplayStore';

const btnStyle: React.CSSProperties = {
  padding: '2px 8px',
  fontSize: 11,
  borderRadius: 3,
  border: '1px solid #313244',
  background: '#313244',
  color: '#cdd6f4',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

const activeBadgeStyle: React.CSSProperties = {
  padding: '2px 8px',
  fontSize: 11,
  borderRadius: 3,
  border: '1px solid #45475a',
  background: '#31324444',
  color: '#a6adc8',
  fontWeight: 'bold',
  textDecoration: 'none',
  display: 'inline-flex',
  alignItems: 'center',
};

export function BacktestLayout({ children, active }: { children: React.ReactNode; active?: 'visualizer' | 'backtest' | 'montecarlo' }) {
  const openHelp = useReplayStore((s) => s.openHelp);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
        background: '#11111b',
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '6px 12px',
          background: '#181825',
          borderBottom: '1px solid #313244',
          flexShrink: 0,
          flexWrap: 'wrap',
        }}
      >
        <Link
          to="/"
          style={{
            color: '#89b4fa',
            fontSize: 12,
            fontWeight: 'bold',
            marginRight: 4,
            textDecoration: 'none',
          }}
        >
          ProsperityIV Tools Hub
        </Link>
        <Link
          to="/"
          style={{
            ...btnStyle,
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
          }}
        >
          Home
        </Link>
        {active === 'visualizer' ? (
          <span style={activeBadgeStyle}>Visualizer</span>
        ) : (
          <Link to="/visualizer" style={{ ...btnStyle, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
            Visualizer
          </Link>
        )}
        {active === 'backtest' ? (
          <span style={activeBadgeStyle}>Backtest</span>
        ) : (
          <Link to="/backtest" style={{ ...btnStyle, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
            Backtest
          </Link>
        )}
        {active === 'montecarlo' ? (
          <span style={activeBadgeStyle}>Monte Carlo</span>
        ) : (
          <Link to="/montecarlo" style={{ ...btnStyle, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
            Monte Carlo
          </Link>
        )}
        <button type="button" style={btnStyle} onClick={openHelp} title="Open user guide">
          How to use
        </button>
        <div style={{ flex: 1 }} />
      </header>
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>{children}</div>
    </div>
  );
}
