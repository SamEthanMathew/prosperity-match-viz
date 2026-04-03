import { Routes, Route } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import { AppShell } from './components/layout/AppShell';
import { BacktestLayout } from './components/layout/BacktestLayout';
import { HelpGuideModal } from './components/help/HelpGuideModal';
import { useKeyboardNav } from './hooks/useKeyboardNav';
import { BacktestPage } from './pages/BacktestPage';

function MainDashboard() {
  useKeyboardNav();
  return (
    <>
      <AppShell />
      <HelpGuideModal />
    </>
  );
}

function BacktestRoute() {
  return (
    <>
      <BacktestLayout>
        <BacktestPage />
      </BacktestLayout>
      <HelpGuideModal />
    </>
  );
}

function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<MainDashboard />} />
        <Route path="/backtest" element={<BacktestRoute />} />
      </Routes>
      <Analytics />
    </>
  );
}

export default App;
