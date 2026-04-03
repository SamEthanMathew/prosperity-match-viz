import { Routes, Route } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import { AppShell } from './components/layout/AppShell';
import { BacktestLayout } from './components/layout/BacktestLayout';
import { HelpGuideModal } from './components/help/HelpGuideModal';
import { useKeyboardNav } from './hooks/useKeyboardNav';
import { BacktestPage } from './pages/BacktestPage';
import { MonteCarloPage } from './pages/MonteCarloPage';

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
      <BacktestLayout active="backtest">
        <BacktestPage />
      </BacktestLayout>
      <HelpGuideModal />
    </>
  );
}

function MonteCarloRoute() {
  return (
    <>
      <BacktestLayout active="montecarlo">
        <MonteCarloPage />
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
        <Route path="/montecarlo" element={<MonteCarloRoute />} />
      </Routes>
      <Analytics />
    </>
  );
}

export default App;
