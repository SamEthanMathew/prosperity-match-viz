import { AppShell } from './components/layout/AppShell';
import { useKeyboardNav } from './hooks/useKeyboardNav';

function App() {
  useKeyboardNav();
  return <AppShell />;
}

export default App;
