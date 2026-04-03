import { useReplayStore } from '../../store/useReplayStore';
import { GlobalToolbar } from './GlobalToolbar';
import { TabBar } from './TabBar';
import { UploadDropzone } from '../upload/UploadDropzone';
import { EquityChart } from '../charts/EquityChart';
import { PriceReplayChart } from '../charts/PriceReplayChart';
import { MicroscopePanel } from '../charts/MicroscopePanel';
import { TradeLedger } from '../charts/TradeLedger';
import { BookmarkList } from '../shared/BookmarkList';
import { InventoryRiskTab } from '../tabs/InventoryRiskTab';
import { SimpleView } from '../simple/SimpleView';
import { StarRepoCallout } from './StarRepoCallout';
import { ExpandablePanel } from '../shared/ExpandablePanel';

export function AppShell() {
  const meta = useReplayStore((s) => s.meta);
  const activeTab = useReplayStore((s) => s.activeTab);
  const simpleMode = useReplayStore((s) => s.simpleMode);

  if (!meta) {
    return <UploadDropzone />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <StarRepoCallout />
      {/* Toolbar */}
      <GlobalToolbar />

      {/* Tab bar — hidden in simple mode */}
      {!simpleMode && <TabBar />}

      {/* Main content */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {simpleMode && <SimpleView />}

        {!simpleMode && activeTab === 'main' && (
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
                <ExpandablePanel id="equity" title="📈 Equity & PnL Timeline">
                  <EquityChart />
                </ExpandablePanel>
              </div>

              {/* Top-right: Price replay */}
              <div style={{ background: '#1e1e2e', overflow: 'hidden', minWidth: 0, minHeight: 0 }}>
                <ExpandablePanel id="price_replay" title="💹 Product Replay">
                  <PriceReplayChart />
                </ExpandablePanel>
              </div>

              {/* Bottom-left: Microscope */}
              <div style={{ background: '#1e1e2e', overflow: 'hidden', minWidth: 0, minHeight: 0 }}>
                <ExpandablePanel id="microscope" title="🔬 Timestamp Microscope">
                  <MicroscopePanel />
                </ExpandablePanel>
              </div>

              {/* Bottom-right: Trade ledger */}
              <div style={{ background: '#1e1e2e', overflow: 'hidden', minWidth: 0, minHeight: 0 }}>
                <ExpandablePanel id="trade_ledger" title="📋 Trade Ledger">
                  <TradeLedger />
                </ExpandablePanel>
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

        {!simpleMode && activeTab === 'inventory_risk' && (
          <div style={{ height: '100%', overflow: 'hidden' }}>
            <InventoryRiskTab />
          </div>
        )}
      </div>
    </div>
  );
}
