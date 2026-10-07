import type { DomainError, GameCommand, GameState, MapLayout } from '@stellar/domain';
import { create, type StoreApi } from 'zustand';
import { type CombatLogEvent, nextCombatLog, opensCombat } from './combat-view.ts';
import { applyCommandWithEvents, createLocalGame } from './local-game.ts';
import { nextSeed } from './store.ts';

export interface GameStore {
  readonly game: GameState | null;
  readonly seed: number;
  readonly error: DomainError | null;
  /** Auf der Karte gewähltes System (z. B. zum Aktivieren). */
  readonly selected: string | null;
  /** Protokoll der laufenden Taktikaktion für die Kampfansicht. */
  readonly combatLog: readonly CombatLogEvent[];
  readonly combatOpen: boolean;
  /** Startet eine lokale Partie auf der aktuellen Galaxie. */
  readonly start: (layout: MapLayout, playerCount: number, seed?: number) => void;
  /** Schickt einen Command an die Domain; liefert false bei Regelverstoß. */
  readonly send: (command: GameCommand) => boolean;
  readonly leave: () => void;
  readonly select: (system: string | null) => void;
  readonly openCombat: () => void;
  readonly closeCombat: () => void;
}

const FRESH = { error: null, selected: null, combatLog: [], combatOpen: false } as const;

type Set = StoreApi<GameStore>['setState'];
type Get = StoreApi<GameStore>['getState'];

const startGame =
  (set: Set): GameStore['start'] =>
  (layout, playerCount, seed = nextSeed()) => {
    const created = createLocalGame(layout, playerCount, seed);
    set(created.ok ? { ...FRESH, game: created.value, seed } : { error: created.error });
  };

const sendCommand =
  (set: Set, get: Get): GameStore['send'] =>
  (command) => {
    const { game, seed, combatLog, combatOpen } = get();
    if (game === null) return false;
    const result = applyCommandWithEvents(game, command, seed);
    if (!result.ok) {
      set({ error: result.error });
      return false;
    }
    const { state, events } = result.value;
    const log = nextCombatLog(combatLog, events);
    set({
      game: state,
      error: null,
      combatLog: log,
      combatOpen: combatOpen || opensCombat(events),
    });
    return true;
  };

export const useGameStore = create<GameStore>()((set, get) => ({
  game: null,
  seed: 0,
  ...FRESH,
  start: startGame(set),
  send: sendCommand(set, get),
  leave: () => set({ ...FRESH, game: null }),
  select: (selected) => set({ selected }),
  openCombat: () => set({ combatOpen: true }),
  closeCombat: () => set({ combatOpen: false }),
}));
