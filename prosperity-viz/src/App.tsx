import { Routes, Route } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import { AppShell } from './components/layout/AppShell';
import { BacktestLayout } from './components/layout/BacktestLayout';
import { HelpGuideModal } from './components/help/HelpGuideModal';
import { useKeyboardNav } from './hooks/useKeyboardNav';
import { BacktestPage } from './pages/BacktestPage';
import { MonteCarloPage } from './pages/MonteCarloPage';
import { HomePage } from './pages/HomePage';

function VisualizerRoute() {
  useKeyboardNav();
  return (
    <>
      <BacktestLayout active="visualizer">
        <AppShell />
      </BacktestLayout>
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
        <Route path="/" element={<HomePage />} />
        <Route path="/visualizer" element={<VisualizerRoute />} />
        <Route path="/backtest" element={<BacktestRoute />} />
        <Route path="/montecarlo" element={<MonteCarloRoute />} />
      </Routes>
      <Analytics />
    </>
  );
}

export default App;
