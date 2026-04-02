import { Analytics } from '@vercel/analytics/react';
import { AppShell } from './components/layout/AppShell';
import { HelpGuideModal } from './components/help/HelpGuideModal';
import { useKeyboardNav } from './hooks/useKeyboardNav';

function App() {
  useKeyboardNav();
  return (
    <>
      <AppShell />
      <HelpGuideModal />
      <Analytics />
    </>
  );
}

export default App;
