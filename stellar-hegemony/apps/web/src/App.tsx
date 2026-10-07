import { type ReactElement, useEffect } from 'react';
import { GalaxyMap } from './components/GalaxyMap.tsx';
import { MapStringPanel } from './components/MapStringPanel.tsx';
import { Toolbar } from './components/Toolbar.tsx';
import { handleShortcut } from './keyboard.ts';
import { useGalaxyStore } from './store.ts';

export function App(): ReactElement {
  const language = useGalaxyStore((state) => state.language);

  useEffect(() => {
    useGalaxyStore.getState().generate();
    const onKey = (event: KeyboardEvent) => {
      if (handleShortcut(event, useGalaxyStore.getState())) event.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  return (
    <div className="app">
      <Toolbar />
      <main className="board">
        <GalaxyMap />
        <MapStringPanel />
      </main>
    </div>
  );
}
