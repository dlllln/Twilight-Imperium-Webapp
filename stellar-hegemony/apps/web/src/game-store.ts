import type { GameUpdate } from '@stellar/application';
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
  /** Online: der eigene Platz; im Hot-Seat `null`, dann entscheidet, wer gerade dran ist. */
  readonly me: PlayerId | null;
  /** Online: schickt Commands an den Server statt sie lokal auszuführen. */
  readonly remote: ((command: GameCommand) => void) | null;
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
  /** Wechselt in eine Online-Partie: Commands gehen an den Server, Zustände kommen von dort. */
  readonly goOnline: (me: PlayerId, remote: (command: GameCommand) => void) => void;
  /** Neuer Stand vom Server, bereits auf die eigene Sicht beschränkt. */
  readonly receive: (update: GameUpdate) => void;
  readonly setBots: (bots: readonly PlayerId[]) => void;
  readonly setError: (error: DomainError | null) => void;
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
    set(
      created.ok
        ? { ...FRESH, game: created.value, seed, bots, me: null, remote: null }
        : { error: created.error },
    );
  };

/** Wer am Bildschirm nicht mitspielt: im Hot-Seat die KI, online alle außer mir. */
const absent = (game: GameState, me: PlayerId | null, bots: readonly PlayerId[]) =>
  me === null ? bots : game.players.map((player) => player.id).filter((id) => id !== me);

/** Neuer Zustand samt Events: Kampfprotokoll fortschreiben, Kampfansicht bei Bedarf öffnen. */
const advance =
  (set: Set, get: Get) =>
  (before: GameState, state: GameState, events: GameUpdate['events']): void => {
    const { combatLog, combatOpen, bots, me } = get();
    const opens = opensCombat(events) && involvesHuman(before, events, absent(before, me, bots));
    set({
      game: state,
      error: null,
      combatLog: nextCombatLog(combatLog, events),
      combatOpen: combatOpen || opens,
    });
  };

const sendCommand =
  (set: Set, get: Get): GameStore['send'] =>
  (command) => {
    const { game, seed, remote } = get();
    if (game === null) return false;
    if (remote !== null) {
      remote(command);
      return true;
    }
    const result = applyCommandWithEvents(game, command, seed);
    if (!result.ok) {
      set({ error: result.error });
      return false;
    }
    advance(set, get)(game, result.value.state, result.value.events);
    return true;
  };

const receiveUpdate =
  (set: Set, get: Get): GameStore['receive'] =>
  ({ state, events }) => {
    const before = get().game ?? state;
    advance(set, get)(before, state, events);
  };

const STUCK: DomainError = { code: 'bot.stuck', message: 'Die KI findet keinen gültigen Zug' };

/** Die KI wählt über dieselbe Domain wie Menschen; ihr Command läuft durch `send`. */
const botStep =
  (set: Set, get: Get): GameStore['botStep'] =>
  () => {
    const { game, seed, bots, send, remote } = get();
    const actor = game === null ? null : currentActor(game);
    if (remote !== null || game === null || actor === null || !bots.includes(actor)) return false;
    const command = heuristicBot.nextCommand(game, actor, decisionContext(game, seed));
    if (command === null) {
      set({ error: STUCK });
      return false;
    }
    return send(command);
  };

const OFFLINE = { game: null, bots: [], me: null, remote: null } as const;

export const useGameStore = create<GameStore>()((set, get) => ({
  seed: 0,
  ...OFFLINE,
  ...FRESH,
  start: startGame(set),
  send: sendCommand(set, get),
  botStep: botStep(set, get),
  leave: () => set({ ...FRESH, ...OFFLINE }),
  // Zustand und Lobby können vor der Bestätigung eintreffen; sie bleiben erhalten.
  goOnline: (me, remote) => set({ me, remote }),
  receive: receiveUpdate(set, get),
  setBots: (bots) => set({ bots }),
  setError: (error) => set({ error }),
  select: (selected) => set({ selected }),
  openCombat: () => set({ combatOpen: true }),
  closeCombat: () => set({ combatOpen: false }),
}));

/** Wer am Bildschirm entscheiden darf: online nur der eigene Platz, im Hot-Seat jeder Mensch. */
export function useHumanActor(game: GameState): PlayerId | null {
  const bots = useGameStore((state) => state.bots);
  const me = useGameStore((state) => state.me);
  const actor = currentActor(game);
  if (actor === null) return null;
  if (me !== null) return actor === me ? me : null;
  return bots.includes(actor) ? null : actor;
}

/** Wessen Hand und Geheimaufträge der Bildschirm zeigt: online immer die eigenen. */
export function useViewer(game: GameState): PlayerId | null {
  const me = useGameStore((state) => state.me);
  const actor = useHumanActor(game);
  return me ?? actor;
}

/** Wer gerade an der Reihe ist, ohne dass dieser Bildschirm entscheidet (KI oder Mitspieler). */
export function useOthersTurn(game: GameState): PlayerId | null {
  const bots = useGameStore((state) => state.bots);
  const me = useGameStore((state) => state.me);
  const actor = currentActor(game);
  if (actor === null) return null;
  if (me !== null) return actor === me ? null : actor;
  return bots.includes(actor) ? actor : null;
}
