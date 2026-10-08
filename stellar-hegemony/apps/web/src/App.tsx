import * as Tooltip from '@radix-ui/react-tooltip';
import { type ReactElement, useEffect } from 'react';
import { CombatView } from './components/combat/CombatView.tsx';
import { GalaxyMap } from './components/GalaxyMap.tsx';
import { GameSidebar } from './components/game/GameSidebar.tsx';
import { FactionDraft } from './components/faction/FactionDraft.tsx';
import { ConnectionBanner } from './components/online/ConnectionBanner.tsx';
import { SetupSidebar } from './components/online/SetupSidebar.tsx';
import { SimulatorScreen } from './components/simulator/SimulatorScreen.tsx';
import { Toolbar } from './components/Toolbar.tsx';
import { TutorialDialog } from './components/tutorial/TutorialDialog.tsx';
import { useSoundEffects } from './audio/use-sound-effects.ts';
import { useGameStore } from './game-store.ts';
import { handleShortcut } from './keyboard.ts';
import { useOnlineStore } from './online/online-store.ts';
import { useSettingsStore } from './settings-store.ts';
import { useGalaxyStore } from './store.ts';
import { useBotDriver } from './use-bot-driver.ts';

/** Während einer Partie bleibt die Galaxie fest; nur Ansichtstasten wirken. */
function onKey(event: KeyboardEvent): void {
  const galaxy = useGalaxyStore.getState();
  const playing = useGameStore.getState().game !== null;
  const shortcuts = playing ? { ...galaxy, generate: () => undefined } : galaxy;
  if (handleShortcut(event, shortcuts)) event.preventDefault();
}

/** Ohne Animationen schaltet eine Klasse am Wurzelelement alle CSS-Bewegungen ab. */
function useMotionSetting(): void {
  const animations = useSettingsStore((state) => state.animations);
  useEffect(() => {
    document.documentElement.classList.toggle('motion-off', !animations);
  }, [animations]);
}

/** Galaxie erzeugen, Online-Platz wiederherstellen, Tastatur und Sprache des Dokuments. */
function useStartup(): void {
  const language = useGalaxyStore((state) => state.language);
  useEffect(() => {
    useGalaxyStore.getState().generate();
    useOnlineStore.getState().restore();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);
}

export function App(): ReactElement {
  const game = useGameStore((state) => state.game);
  useStartup();
  useBotDriver();
  useSoundEffects();
  useMotionSetting();

  return (
    <Tooltip.Provider delayDuration={250}>
      <div className="app">
        <Toolbar />
        <ConnectionBanner />
        <main className={game === null ? 'board' : 'board playing'}>
          <GalaxyMap />
          {game === null ? <SetupSidebar /> : <GameSidebar game={game} />}
        </main>
        {game !== null && <CombatView />}
        <TutorialDialog />
        <SimulatorScreen />
        <FactionDraft />
      </div>
    </Tooltip.Provider>
  );
}
