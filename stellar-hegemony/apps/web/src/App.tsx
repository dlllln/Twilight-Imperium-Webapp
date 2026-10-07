import { type ReactElement, useEffect } from 'react';
import { GalaxyMap } from './components/GalaxyMap.tsx';
import { GameSidebar } from './components/game/GameSidebar.tsx';
import { PhaseBar } from './components/game/PhaseBar.tsx';
import { MapStringPanel } from './components/MapStringPanel.tsx';
import { Toolbar } from './components/Toolbar.tsx';
import { useGameStore } from './game-store.ts';
import { handleShortcut } from './keyboard.ts';
import { useGalaxyStore } from './store.ts';

/** Während einer Partie bleibt die Galaxie fest; nur Ansichtstasten wirken. */
function onKey(event: KeyboardEvent): void {
  const galaxy = useGalaxyStore.getState();
  const playing = useGameStore.getState().game !== null;
  const shortcuts = playing ? { ...galaxy, generate: () => undefined } : galaxy;
  if (handleShortcut(event, shortcuts)) event.preventDefault();
}

export function App(): ReactElement {
  const language = useGalaxyStore((state) => state.language);
  const game = useGameStore((state) => state.game);

  useEffect(() => {
    useGalaxyStore.getState().generate();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  return (
    <div className="app">
      <Toolbar />
      {game !== null && <PhaseBar game={game} />}
      <main className={game === null ? 'board' : 'board playing'}>
        <GalaxyMap />
        {game === null ? <MapStringPanel /> : <GameSidebar game={game} />}
      </main>
    </div>
  );
}
