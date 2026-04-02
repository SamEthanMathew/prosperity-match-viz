import { useEffect, useState, useRef } from 'react';
import ReactDOM from 'react-dom';
import { useReplayStore } from '../../store/useReplayStore';

interface ExpandablePanelProps {
  id: string;
  title: string;
  children: React.ReactNode;
}

function ScaleSettings({ id, onClose }: { id: string; onClose: () => void }) {
  const chartScales = useReplayStore((s) => s.chartScales);
  const setChartScale = useReplayStore((s) => s.setChartScale);
  const current = chartScales[id];

  const [xInput, setXInput] = useState(String(current?.x ?? 1));
  const [yInput, setYInput] = useState(String(current?.y ?? 1));

  const apply = () => {
    const x = parseFloat(xInput);
    const y = parseFloat(yInput);
    if (!isNaN(x) && !isNaN(y) && x > 0 && y > 0) {
      setChartScale(id, { x, y });
    }
  };

  const reset = () => {
    setChartScale(id, null);
    setXInput('1');
    setYInput('1');
  };

  return (
    <div
      style={{
        position: 'absolute',
        top: '100%',
        right: 0,
        zIndex: 200,
        background: '#181825',
        border: '1px solid #45475a',
        borderRadius: 6,
        padding: '10px 12px',
        minWidth: 200,
        boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div style={{ color: '#89b4fa', fontSize: 11, fontWeight: 'bold', marginBottom: 8 }}>
        Axis Scale Ratio
      </div>
      <div style={{ color: '#6c7086', fontSize: 10, marginBottom: 10, lineHeight: 1.4 }}>
        Set the visual scale for each axis. 1:1 means equal pixel distance per unit on both axes.
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <label style={{ color: '#a6adc8', fontSize: 11, width: 14 }}>X</label>
        <input
          type="number"
          min="0.01"
          step="0.5"
          value={xInput}
          onChange={(e) => setXInput(e.target.value)}
          style={{
            flex: 1,
            padding: '3px 6px',
            fontSize: 11,
            background: '#313244',
            border: '1px solid #45475a',
            borderRadius: 3,
            color: '#cdd6f4',
            width: 0,
          }}
        />
        <span style={{ color: '#45475a', fontSize: 12 }}>:</span>
        <label style={{ color: '#a6adc8', fontSize: 11, width: 14 }}>Y</label>
        <input
          type="number"
          min="0.01"
          step="0.5"
          value={yInput}
          onChange={(e) => setYInput(e.target.value)}
          style={{
            flex: 1,
            padding: '3px 6px',
            fontSize: 11,
            background: '#313244',
            border: '1px solid #45475a',
            borderRadius: 3,
            color: '#cdd6f4',
            width: 0,
          }}
        />
      </div>

      {/* Preset buttons */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 10, flexWrap: 'wrap' }}>
        {[['1:1', 1, 1], ['1:2', 1, 2], ['2:1', 2, 1], ['1:5', 1, 5], ['5:1', 5, 1]].map(
          ([label, x, y]) => {
            const isActive = current && current.x === x && current.y === y;
            return (
              <button
                key={String(label)}
                onClick={() => {
                  setXInput(String(x));
                  setYInput(String(y));
                  setChartScale(id, { x: x as number, y: y as number });
                }}
                style={{
                  padding: '2px 7px',
                  fontSize: 10,
                  borderRadius: 3,
                  border: `1px solid ${isActive ? '#89b4fa' : '#313244'}`,
                  background: isActive ? '#89b4fa22' : 'transparent',
                  color: isActive ? '#89b4fa' : '#a6adc8',
                  cursor: 'pointer',
                }}
              >
                {String(label)}
              </button>
            );
          },
        )}
      </div>

      <div style={{ display: 'flex', gap: 6 }}>
        <button
          onClick={apply}
          style={{
            flex: 1,
            padding: '4px 8px',
            fontSize: 11,
            borderRadius: 3,
            border: '1px solid #89b4fa',
            background: '#89b4fa22',
            color: '#89b4fa',
            cursor: 'pointer',
          }}
        >
          Apply
        </button>
        <button
          onClick={reset}
          style={{
            flex: 1,
            padding: '4px 8px',
            fontSize: 11,
            borderRadius: 3,
            border: '1px solid #45475a',
            background: 'transparent',
            color: '#f38ba8',
            cursor: 'pointer',
          }}
        >
          Reset
        </button>
        <button
          onClick={onClose}
          style={{
            padding: '4px 8px',
            fontSize: 11,
            borderRadius: 3,
            border: '1px solid #313244',
            background: 'transparent',
            color: '#6c7086',
            cursor: 'pointer',
          }}
        >
          ✕
        </button>
      </div>

      {current && (
        <div style={{ marginTop: 8, color: '#585b70', fontSize: 10 }}>
          Active: {current.x} : {current.y} (ratio {(current.y / current.x).toFixed(3)})
        </div>
      )}
    </div>
  );
}

function PanelHeader({
  id,
  title,
  onExpand,
  isModal = false,
}: {
  id: string;
  title: string;
  onExpand: () => void;
  isModal?: boolean;
}) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const chartScales = useReplayStore((s) => s.chartScales);
  const hasScale = !!chartScales[id];

  // Close settings on outside click
  useEffect(() => {
    if (!settingsOpen) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setSettingsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [settingsOpen]);

  return (
    <div
      ref={containerRef}
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '4px 8px',
        borderBottom: '1px solid #313244',
        flexShrink: 0,
        position: 'relative',
      }}
    >
      <span style={{ color: '#89b4fa', fontSize: 11, fontWeight: 'bold', flex: 1 }}>
        {title}
      </span>

      {isModal && (
        <span style={{ color: '#45475a', fontSize: 10, marginRight: 6 }}>
          Scroll to zoom · Drag to pan · Drag axes to scale
        </span>
      )}

      {/* Settings gear */}
      <button
        onClick={() => setSettingsOpen((v) => !v)}
        title="Axis scale settings"
        style={{
          background: 'transparent',
          border: 'none',
          color: hasScale ? '#f9e2af' : '#585b70',
          cursor: 'pointer',
          fontSize: 12,
          padding: '0 3px',
          lineHeight: 1,
          transition: 'color 0.15s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = '#f9e2af')}
        onMouseLeave={(e) => (e.currentTarget.style.color = hasScale ? '#f9e2af' : '#585b70')}
      >
        ⚙
      </button>

      {/* Expand / close button */}
      <button
        onClick={onExpand}
        title={isModal ? 'Close (Escape)' : 'Expand to fullscreen (Escape to close)'}
        style={{
          background: 'transparent',
          border: 'none',
          color: '#585b70',
          cursor: 'pointer',
          fontSize: isModal ? 16 : 15,
          padding: '0 2px',
          lineHeight: 1,
          transition: 'color 0.15s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = isModal ? '#f38ba8' : '#89b4fa')}
        onMouseLeave={(e) => (e.currentTarget.style.color = '#585b70')}
      >
        {isModal ? '✕' : '⛶'}
      </button>

      {settingsOpen && (
        <ScaleSettings id={id} onClose={() => setSettingsOpen(false)} />
      )}
    </div>
  );
}

export function ExpandablePanel({ id, title, children }: ExpandablePanelProps) {
  const expandedChart = useReplayStore((s) => s.expandedChart);
  const setExpandedChart = useReplayStore((s) => s.setExpandedChart);
  const isExpanded = expandedChart === id;

  useEffect(() => {
    if (!isExpanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExpandedChart(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isExpanded, setExpandedChart]);

  return (
    <>
      {/* Panel (normal mode) */}
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <PanelHeader id={id} title={title} onExpand={() => setExpandedChart(id)} />

        {/* Chart area — only renders children when NOT expanded */}
        <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
          {isExpanded ? (
            <div
              style={{
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#45475a',
                fontSize: 12,
                gap: 8,
              }}
            >
              <span style={{ fontSize: 16 }}>⛶</span>
              Chart is open in fullscreen
            </div>
          ) : (
            children
          )}
        </div>
      </div>

      {/* Fullscreen modal portal */}
      {isExpanded &&
        ReactDOM.createPortal(
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9999,
              background: 'rgba(0,0,0,0.8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) setExpandedChart(null);
            }}
          >
            <div
              style={{
                width: '94vw',
                height: '90vh',
                background: '#1e1e2e',
                borderRadius: 8,
                border: '1px solid #45475a',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
              }}
            >
              {/* Modal header — reuses PanelHeader (settings ⚙ available here too); ⛶ closes modal */}
              <PanelHeader id={id} title={title} onExpand={() => setExpandedChart(null)} isModal />

              {/* Chart content */}
              <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
                {children}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
