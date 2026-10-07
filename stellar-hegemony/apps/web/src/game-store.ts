import { heuristicBot } from '@stellar/bots';
import {
  currentActor,
  type DomainError,
  type GameCommand,
  type GameState,
  type MapLayout,
  type PlayerId,
} from '@stellar/domain';
import { create, type StoreApi } from 'zustand';
import { type CombatLogEvent, involvesHuman, nextCombatLog, opensCombat } from './combat-view.ts';
import {
  applyCommandWithEvents,
  botSeats,
  createLocalGame,
  decisionContext,
} from './local-game.ts';
import { nextSeed } from './store.ts';

export interface GameStore {
  readonly game: GameState | null;
  readonly seed: number;
  readonly error: DomainError | null;
  /** Plätze, die eine KI spielt. */
  readonly bots: readonly PlayerId[];
  /** Auf der Karte gewähltes System (z. B. zum Aktivieren). */
  readonly selected: string | null;
  /** Protokoll der laufenden Taktikaktion für die Kampfansicht. */
  readonly combatLog: readonly CombatLogEvent[];
  readonly combatOpen: boolean;
  /** Startet eine lokale Partie auf der aktuellen Galaxie; KI-Gegner auf den letzten Plätzen. */
  readonly start: (
    layout: MapLayout,
    playerCount: number,
    seed?: number,
    botCount?: number,
  ) => void;
  /** Schickt einen Command an die Domain; liefert false bei Regelverstoß. */
  readonly send: (command: GameCommand) => boolean;
  /** Lässt die KI ziehen, wenn sie an der Reihe ist; false, wenn kein Bot dran ist. */
  readonly botStep: () => boolean;
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
  (layout, playerCount, seed = nextSeed(), botCount = 0) => {
    const created = createLocalGame(layout, playerCount, seed, botCount);
    const bots = botSeats(playerCount, botCount);
    set(created.ok ? { ...FRESH, game: created.value, seed, bots } : { error: created.error });
  };

const sendCommand =
  (set: Set, get: Get): GameStore['send'] =>
  (command) => {
    const { game, seed, combatLog, combatOpen, bots } = get();
    if (game === null) return false;
    const result = applyCommandWithEvents(game, command, seed);
    if (!result.ok) {
      set({ error: result.error });
      return false;
    }
    const { state, events } = result.value;
    const opens = opensCombat(events) && involvesHuman(game, events, bots);
    set({
      game: state,
      error: null,
      combatLog: nextCombatLog(combatLog, events),
      combatOpen: combatOpen || opens,
    });
    return true;
  };

const STUCK: DomainError = { code: 'bot.stuck', message: 'Die KI findet keinen gültigen Zug' };

/** Die KI wählt über dieselbe Domain wie Menschen; ihr Command läuft durch `send`. */
const botStep =
  (set: Set, get: Get): GameStore['botStep'] =>
  () => {
    const { game, seed, bots, send } = get();
    const actor = game === null ? null : currentActor(game);
    if (game === null || actor === null || !bots.includes(actor)) return false;
    const command = heuristicBot.nextCommand(game, actor, decisionContext(game, seed));
    if (command === null) {
      set({ error: STUCK });
      return false;
    }
    return send(command);
  };

export const useGameStore = create<GameStore>()((set, get) => ({
  game: null,
  seed: 0,
  bots: [],
  ...FRESH,
  start: startGame(set),
  send: sendCommand(set, get),
  botStep: botStep(set, get),
  leave: () => set({ ...FRESH, game: null, bots: [] }),
  select: (selected) => set({ selected }),
  openCombat: () => set({ combatOpen: true }),
  closeCombat: () => set({ combatOpen: false }),
}));

/** Wer am Bildschirm entscheiden darf: der aktuelle Spieler, außer eine KI ist dran. */
export function useHumanActor(game: GameState): PlayerId | null {
  const bots = useGameStore((state) => state.bots);
  const actor = currentActor(game);
  return actor !== null && bots.includes(actor) ? null : actor;
}

/** Ob gerade eine KI an der Reihe ist. */
export function useBotTurn(game: GameState): PlayerId | null {
  const bots = useGameStore((state) => state.bots);
  const actor = currentActor(game);
  return actor !== null && bots.includes(actor) ? actor : null;
}
