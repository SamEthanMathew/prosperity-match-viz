import { useReplayStore } from '../../store/useReplayStore';
import { GlobalToolbar } from './GlobalToolbar';
import { TabBar } from './TabBar';
import { UploadDropzone } from '../upload/UploadDropzone';
import { EquityChart } from '../charts/EquityChart';
import { PriceReplayChart } from '../charts/PriceReplayChart';
import { MicroscopePanel } from '../charts/MicroscopePanel';
import { TradeLedger } from '../charts/TradeLedger';
import { BookmarkList } from '../shared/BookmarkList';
import { DecisionModeTab } from '../tabs/DecisionModeTab';
import { InventoryRiskTab } from '../tabs/InventoryRiskTab';
import { BookPressureTab } from '../tabs/BookPressureTab';

export function AppShell() {
  const meta = useReplayStore((s) => s.meta);
  const activeTab = useReplayStore((s) => s.activeTab);

  if (!meta) {
    return <UploadDropzone />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Toolbar */}
      <GlobalToolbar />

      {/* Tab bar */}
      <TabBar />

      {/* Main content */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {activeTab === 'main' && (
          <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
            {/* Main 4-panel grid */}
            <div
              style={{
                flex: 1,
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gridTemplateRows: '1fr 1fr',
                gap: 1,
                background: '#313244',
                minWidth: 0,
              }}
            >
              {/* Top-left: Equity chart */}
              <div style={{ background: '#1e1e2e', overflow: 'hidden', minWidth: 0, minHeight: 0 }}>
                <div style={{ padding: '4px 8px', borderBottom: '1px solid #313244', color: '#89b4fa', fontSize: 11, fontWeight: 'bold' }}>
                  📈 Equity & PnL Timeline
                </div>
                <div style={{ height: 'calc(100% - 26px)', overflow: 'hidden' }}>
                  <EquityChart />
                </div>
              </div>

              {/* Top-right: Price replay */}
              <div style={{ background: '#1e1e2e', overflow: 'hidden', minWidth: 0, minHeight: 0 }}>
                <div style={{ padding: '4px 8px', borderBottom: '1px solid #313244', color: '#89b4fa', fontSize: 11, fontWeight: 'bold' }}>
                  💹 Product Replay
                </div>
                <div style={{ height: 'calc(100% - 26px)', overflow: 'hidden' }}>
                  <PriceReplayChart />
                </div>
              </div>

              {/* Bottom-left: Microscope */}
              <div style={{ background: '#1e1e2e', overflow: 'hidden', minWidth: 0, minHeight: 0 }}>
                <MicroscopePanel />
              </div>

              {/* Bottom-right: Trade ledger */}
              <div style={{ background: '#1e1e2e', overflow: 'hidden', minWidth: 0, minHeight: 0 }}>
                <TradeLedger />
              </div>
            </div>

            {/* Bookmark sidebar */}
            <div
              style={{
                width: 220,
                background: '#1e1e2e',
                borderLeft: '1px solid #313244',
                overflow: 'hidden',
                flexShrink: 0,
              }}
            >
              <BookmarkList />
            </div>
          </div>
        )}

        {activeTab === 'decision_mode' && (
          <div style={{ height: '100%', overflow: 'hidden' }}>
            <DecisionModeTab />
          </div>
        )}

        {activeTab === 'inventory_risk' && (
          <div style={{ height: '100%', overflow: 'hidden' }}>
            <InventoryRiskTab />
          </div>
        )}

        {activeTab === 'book_pressure' && (
          <div style={{ height: '100%', overflow: 'hidden' }}>
            <BookPressureTab />
          </div>
        )}
      </div>
    </div>
  );
}
