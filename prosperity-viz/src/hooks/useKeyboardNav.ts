import { useEffect } from 'react';
import { useReplayStore } from '../store/useReplayStore';

export function useKeyboardNav() {
  const navigateFill = useReplayStore((s) => s.navigateFill);
  const navigateModeSwitch = useReplayStore((s) => s.navigateModeSwitch);
  const meta = useReplayStore((s) => s.meta);

  useEffect(() => {
    if (!meta) return;

    const handler = (e: KeyboardEvent) => {
      // Don't intercept when typing in inputs
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) return;

      if (e.key === 'ArrowRight' && !e.shiftKey) navigateFill('next');
      if (e.key === 'ArrowLeft' && !e.shiftKey) navigateFill('prev');
      if (e.key === 'ArrowRight' && e.shiftKey) navigateModeSwitch('next');
      if (e.key === 'ArrowLeft' && e.shiftKey) navigateModeSwitch('prev');
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [meta, navigateFill, navigateModeSwitch]);
}
