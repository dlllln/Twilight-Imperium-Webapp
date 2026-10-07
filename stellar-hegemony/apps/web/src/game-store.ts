import type { DomainError, GameCommand, GameState, MapLayout } from '@stellar/domain';
import { create, type StoreApi } from 'zustand';
import { applyCommand, createLocalGame } from './local-game.ts';
import { nextSeed } from './store.ts';

export interface GameStore {
  readonly game: GameState | null;
  readonly seed: number;
  readonly error: DomainError | null;
  /** Auf der Karte gewähltes System (z. B. zum Aktivieren). */
  readonly selected: string | null;
  /** Startet eine lokale Partie auf der aktuellen Galaxie. */
  readonly start: (layout: MapLayout, playerCount: number, seed?: number) => void;
  /** Schickt einen Command an die Domain; liefert false bei Regelverstoß. */
  readonly send: (command: GameCommand) => boolean;
  readonly leave: () => void;
  readonly select: (system: string | null) => void;
}

type Set = StoreApi<GameStore>['setState'];
type Get = StoreApi<GameStore>['getState'];

const startGame =
  (set: Set): GameStore['start'] =>
  (layout, playerCount, seed = nextSeed()) => {
    const created = createLocalGame(layout, playerCount, seed);
    set(
      created.ok
        ? { game: created.value, seed, error: null, selected: null }
        : { error: created.error },
    );
  };

const sendCommand =
  (set: Set, get: Get): GameStore['send'] =>
  (command) => {
    const { game, seed } = get();
    if (game === null) return false;
    const result = applyCommand(game, command, seed);
    set(result.ok ? { game: result.value, error: null } : { error: result.error });
    return result.ok;
  };

export const useGameStore = create<GameStore>()((set, get) => ({
  game: null,
  seed: 0,
  error: null,
  selected: null,
  start: startGame(set),
  send: sendCommand(set, get),
  leave: () => set({ game: null, error: null, selected: null }),
  select: (selected) => set({ selected }),
}));
