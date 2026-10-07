import type { DomainError, GameCommand, GameState, MapLayout } from '@stellar/domain';
import { create } from 'zustand';
import { applyCommand, createLocalGame } from './local-game.ts';
import { nextSeed } from './store.ts';

export interface GameStore {
  readonly game: GameState | null;
  readonly seed: number;
  readonly error: DomainError | null;
  /** Startet eine lokale Partie auf der aktuellen Galaxie. */
  readonly start: (layout: MapLayout, playerCount: number, seed?: number) => void;
  /** Schickt einen Command an die Domain; liefert false bei Regelverstoß. */
  readonly send: (command: GameCommand) => boolean;
  readonly leave: () => void;
}

export const useGameStore = create<GameStore>()((set, get) => ({
  game: null,
  seed: 0,
  error: null,
  start: (layout, playerCount, seed = nextSeed()) => {
    const created = createLocalGame(layout, playerCount, seed);
    set(created.ok ? { game: created.value, seed, error: null } : { error: created.error });
  },
  send: (command) => {
    const { game, seed } = get();
    if (game === null) return false;
    const result = applyCommand(game, command, seed);
    set(result.ok ? { game: result.value, error: null } : { error: result.error });
    return result.ok;
  },
  leave: () => set({ game: null, error: null }),
}));
