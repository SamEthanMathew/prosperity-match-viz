import { useCallback, useState } from 'react';
import { GITHUB_REPO_URL, STAR_CTA_STORAGE_KEY } from '../../lib/repoMeta';

const btn: React.CSSProperties = {
  padding: '4px 10px',
  fontSize: 11,
  borderRadius: 4,
  border: '1px solid #45475a',
  background: '#313244',
  color: '#cdd6f4',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

const btnPrimary: React.CSSProperties = {
  ...btn,
  background: '#45475a',
  borderColor: '#585b70',
  color: '#89b4fa',
};

export function StarRepoCallout() {
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(STAR_CTA_STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  });

  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(STAR_CTA_STORAGE_KEY, '1');
    } catch {
      /* ignore quota / private mode */
    }
    setHidden(true);
  }, []);

  if (hidden) return null;

  return (
    <div
      role="region"
      aria-label="Support this project"
      style={{
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        flexWrap: 'wrap',
        padding: '8px 12px',
        background: '#181825',
        borderBottom: '1px solid #313244',
        color: '#bac2de',
        fontSize: 12,
        lineHeight: 1.4,
      }}
    >
      <span style={{ minWidth: 200 }}>
        Finding this useful? Consider{' '}
        <a
          href={GITHUB_REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: '#89b4fa', fontWeight: 600 }}
        >
          starring the repo on GitHub
        </a>{' '}
        — it helps others discover the tool.
      </span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <a
          href={GITHUB_REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
          style={{ ...btnPrimary, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
        >
          Open repo
        </a>
        <button type="button" style={btn} onClick={dismiss}>
          Dismiss
        </button>
      </span>
    </div>
  );
}
