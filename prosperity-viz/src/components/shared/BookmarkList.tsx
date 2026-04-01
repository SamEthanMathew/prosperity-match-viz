import { useReplayStore } from '../../store/useReplayStore';
import type { Bookmark } from '../../types/data';

const CATEGORY_ICONS: Record<string, string> = {
  max_drawdown: '📉',
  max_profit: '📈',
  near_cap: '⚠️',
  mode_switch: '🔀',
  large_fill: '💰',
  manual: '⭐',
};

function BookmarkItem({ bm }: { bm: Bookmark }) {
  const setActiveTimestamp = useReplayStore((s) => s.setActiveTimestamp);
  const removeBookmark = useReplayStore((s) => s.removeBookmark);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '3px 6px',
        borderBottom: '1px solid #313244',
        cursor: 'pointer',
        fontSize: 10,
      }}
      onClick={() => setActiveTimestamp(bm.timestamp)}
    >
      <span style={{ flexShrink: 0 }}>{CATEGORY_ICONS[bm.category] ?? '•'}</span>
      <span style={{ color: '#a6adc8', flexShrink: 0, fontFamily: 'monospace', width: 48 }}>
        {(bm.timestamp / 1000).toFixed(1)}s
      </span>
      <span style={{ color: '#cdd6f4', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {bm.label}
      </span>
      {bm.category === 'manual' && (
        <span
          style={{ color: '#45475a', cursor: 'pointer', flexShrink: 0 }}
          onClick={(e) => {
            e.stopPropagation();
            removeBookmark(bm.id);
          }}
        >
          ✕
        </span>
      )}
    </div>
  );
}

export function BookmarkList() {
  const bookmarks = useReplayStore((s) => s.bookmarks);

  return (
    <div style={{ height: '100%', overflow: 'auto', fontSize: 10 }}>
      <div style={{ padding: '4px 8px', background: '#181825', color: '#89b4fa', fontWeight: 'bold', fontSize: 11, position: 'sticky', top: 0 }}>
        🔖 Bookmarks ({bookmarks.length})
      </div>
      {bookmarks.map((bm) => (
        <BookmarkItem key={bm.id} bm={bm} />
      ))}
      {bookmarks.length === 0 && (
        <div style={{ color: '#6c7086', padding: 8, fontSize: 10 }}>
          No bookmarks yet
        </div>
      )}
    </div>
  );
}
