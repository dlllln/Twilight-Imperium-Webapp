import { create } from 'zustand';
import { useGameStore } from '../game-store.ts';
import { botSeats } from '../local-game.ts';
import { content, useGalaxyStore } from '../store.ts';
import { firstFree } from './faction-draft.ts';

/** Fraktionswahl vor der Partie: jeder menschliche Platz wählt der Reihe nach. */
interface DraftStore {
  readonly open: boolean;
  /** Wie viele Plätze von Menschen gewählt werden. */
  readonly humans: number;
  readonly picks: readonly string[];
  readonly preview: string;
  readonly begin: () => void;
  readonly show: (faction: string) => void;
  /** Übernimmt die angezeigte Fraktion; nach dem letzten Platz beginnt die Partie. */
  readonly choose: () => void;
  /** Nimmt die letzte Wahl zurück; ohne Wahl schließt die Auswahl. */
  readonly back: () => void;
}

function humanSeats(): number {
  const { playerCount, botCount } = useGalaxyStore.getState();
  return playerCount - botSeats(playerCount, botCount).length;
}

function startWith(picks: readonly string[]): void {
  const { layout, playerCount, botCount } = useGalaxyStore.getState();
  useGameStore.getState().start(layout, playerCount, undefined, botCount, picks);
}

type Set = (partial: Partial<DraftStore>) => void;
type Get = () => DraftStore;

function choose(set: Set, get: Get): void {
  const { picks, preview, humans } = get();
  const next = [...picks, preview];
  if (next.length < humans) {
    set({ picks: next, preview: firstFree(content.factions, next) });
    return;
  }
  set({ open: false, picks: [] });
  startWith(next);
}

export const useDraftStore = create<DraftStore>((set, get) => ({
  open: false,
  humans: 1,
  picks: [],
  preview: firstFree(content.factions, []),
  begin: () =>
    set({ open: true, humans: humanSeats(), picks: [], preview: firstFree(content.factions, []) }),
  show: (preview) => {
    if (!get().picks.includes(preview)) set({ preview });
  },
  choose: () => choose(set, get),
  back: () => {
    const { picks } = get();
    if (picks.length === 0) set({ open: false });
    else set({ picks: picks.slice(0, -1), preview: picks.at(-1) ?? get().preview });
  },
}));
