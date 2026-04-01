import { useReplayStore } from '../../store/useReplayStore';
import type { TabId } from '../../types/data';

const TABS: { id: TabId; label: string }[] = [
  { id: 'main', label: '📊 Main' },
  { id: 'decision_mode', label: '🔀 Modes' },
  { id: 'inventory_risk', label: '📦 Inventory' },
  { id: 'book_pressure', label: '📡 Signals' },
];

export function TabBar() {
  const activeTab = useReplayStore((s) => s.activeTab);
  const setActiveTab = useReplayStore((s) => s.setActiveTab);

  return (
    <div style={{
      display: 'flex',
      borderBottom: '1px solid #313244',
      background: '#181825',
      flexShrink: 0,
    }}>
      {TABS.map((tab) => (
        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id)}
          style={{
            padding: '5px 14px',
            fontSize: 11,
            border: 'none',
            borderBottom: activeTab === tab.id ? '2px solid #89b4fa' : '2px solid transparent',
            background: activeTab === tab.id ? '#1e1e2e' : 'transparent',
            color: activeTab === tab.id ? '#cdd6f4' : '#7f849c',
            cursor: 'pointer',
            transition: 'color 0.1s, background 0.1s',
          }}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
