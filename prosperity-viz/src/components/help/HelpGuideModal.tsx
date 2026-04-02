import { useEffect } from 'react';
import { useReplayStore } from '../../store/useReplayStore';
import { GuideContent } from './guideContent';

const btnStyle: React.CSSProperties = {
  padding: '2px 10px',
  fontSize: 11,
  borderRadius: 3,
  border: '1px solid #313244',
  background: '#313244',
  color: '#cdd6f4',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

export function HelpGuideModal() {
  const helpOpen = useReplayStore((s) => s.helpOpen);
  const closeHelp = useReplayStore((s) => s.closeHelp);

  useEffect(() => {
    if (!helpOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeHelp();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [helpOpen, closeHelp]);

  if (!helpOpen) return null;

  return (
    <div
      role="presentation"
      onClick={closeHelp}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        role="dialog"
        aria-labelledby="help-guide-title"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 700,
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          background: '#181825',
          border: '1px solid #313244',
          borderRadius: 8,
          boxShadow: '0 12px 40px rgba(0,0,0,0.45)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: '10px 14px',
            borderBottom: '1px solid #313244',
            background: '#1e1e2e',
            flexShrink: 0,
          }}
        >
          <h1
            id="help-guide-title"
            style={{
              margin: 0,
              fontSize: 14,
              fontWeight: 'bold',
              color: '#89b4fa',
            }}
          >
            How to use
          </h1>
          <button type="button" style={btnStyle} onClick={closeHelp} title="Close (Esc)">
            Close
          </button>
        </div>
        <div
          style={{
            overflow: 'auto',
            padding: '12px 16px 20px',
            minHeight: 0,
          }}
        >
          <GuideContent />
        </div>
      </div>
    </div>
  );
}
