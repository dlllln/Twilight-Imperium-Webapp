import type { CommandReceipt, GameUpdate } from '@stellar/application';
import {
  currentActor,
  type DomainError,
  type GameCommand,
  type GameEvent,
  type GameState,
  type PlayerId,
} from '@stellar/domain';
import { create, type StoreApi } from 'zustand';
import { type CombatLogEvent, involvesHuman, nextCombatLog, opensCombat } from './combat-view.ts';
import { appendHistory, type HistoryEntry } from './history/turn-history.ts';

export interface LastEvents {
  readonly serial: number;
  readonly before: GameState;
  readonly events: readonly GameEvent[];
}

/** Weg zum Server (Dependency Inversion): online der Socket, in Tests eine Schleife im Speicher. */
export interface Remote {
  readonly command: (command: GameCommand) => void;
  readonly undo: () => void;
}

/**
 * Die laufende Partie im Browser. Gespielt wird nur online: Jeder Mensch sitzt an seinem
 * eigenen Gerät, der Server entscheidet, und dieser Store zeigt den Stand aus eigener Sicht.
 */
export interface GameStore {
  readonly game: GameState | null;
  readonly error: DomainError | null;
  /** Plätze, die eine KI spielt. */
  readonly bots: readonly PlayerId[];
  /** Der eigene Platz. */
  readonly me: PlayerId | null;
  readonly remote: Remote | null;
  /** Auf der Karte gewähltes System (z. B. zum Aktivieren). */
  readonly selected: string | null;
  /** Protokoll der laufenden Taktikaktion für die Kampfansicht. */
  readonly combatLog: readonly CombatLogEvent[];
  readonly combatOpen: boolean;
  /** Die Events des letzten Zugs samt Zustand davor; Animationen und Klänge hängen daran. */
  readonly lastEvents: LastEvents | null;
  /** Zugverlauf „Was ist passiert?“. */
  readonly history: readonly HistoryEntry[];
  /** Solange die Partie bei dieser Version steht, lässt sich der eigene letzte Schritt zurücknehmen. */
  readonly undoVersion: number | null;
  /** Schickt einen Command an den Server; false ohne laufende Partie. */
  readonly send: (command: GameCommand) => boolean;
  readonly undo: () => void;
  /** Antwort des Servers auf den eigenen Command. */
  readonly acknowledge: (receipt: CommandReceipt) => void;
  readonly leave: () => void;
  /** Setzt sich auf den eigenen Platz: Commands gehen an den Server, Zustände kommen von dort. */
  readonly goOnline: (me: PlayerId, remote: Remote) => void;
  /** Neuer Stand vom Server, bereits auf die eigene Sicht beschränkt. */
  readonly receive: (update: GameUpdate) => void;
  readonly setBots: (bots: readonly PlayerId[]) => void;
  readonly setError: (error: DomainError | null) => void;
  readonly select: (system: string | null) => void;
  readonly openCombat: () => void;
  readonly closeCombat: () => void;
}

const FRESH = {
  error: null,
  selected: null,
  combatLog: [],
  combatOpen: false,
  lastEvents: null,
  history: [],
  undoVersion: null,
} as const;

type Set = StoreApi<GameStore>['setState'];
type Get = StoreApi<GameStore>['getState'];

/** Wer am Bildschirm nicht mitspielt: alle außer mir. */
const absent = (game: GameState, me: PlayerId | null) =>
  game.players.map((player) => player.id).filter((id) => id !== me);

/** Neuer Zustand samt Events: Verlauf und Kampfprotokoll fortschreiben, Kampfansicht öffnen. */
const advance =
  (set: Set, get: Get) =>
  (before: GameState, state: GameState, events: GameUpdate['events']): void => {
    const { combatLog, combatOpen, me, lastEvents, history } = get();
    const opens = opensCombat(events) && involvesHuman(before, events, absent(before, me));
    set({
      game: state,
      error: null,
      combatLog: nextCombatLog(combatLog, events),
      combatOpen: combatOpen || opens,
      lastEvents: { serial: (lastEvents?.serial ?? 0) + 1, before, events },
      history: appendHistory(history, events),
    });
  };

const sendCommand =
  (get: Get): GameStore['send'] =>
  (command) => {
    const { game, remote } = get();
    if (game === null || remote === null) return false;
    remote.command(command);
    return true;
  };

const receiveUpdate =
  (set: Set, get: Get): GameStore['receive'] =>
  ({ state, events }) => {
    const before = get().game ?? state;
    advance(set, get)(before, state, events);
  };

const OFFLINE = { game: null, bots: [], me: null, remote: null } as const;

export const useGameStore = create<GameStore>()((set, get) => ({
  ...OFFLINE,
  ...FRESH,
  send: sendCommand(get),
  undo: () => {
    set({ undoVersion: null });
    get().remote?.undo();
  },
  acknowledge: ({ version, undoable }) => set({ undoVersion: undoable ? version : null }),
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

/** Wer an diesem Bildschirm entscheiden darf: nur der eigene Platz, und nur wenn er dran ist. */
export function useHumanActor(game: GameState): PlayerId | null {
  const me = useGameStore((state) => state.me);
  return me !== null && currentActor(game) === me ? me : null;
}

/** Wessen Hand und Geheimaufträge der Bildschirm zeigt: immer die eigenen. */
export function useViewer(): PlayerId | null {
  return useGameStore((state) => state.me);
}

/** Wer gerade an der Reihe ist, ohne dass dieser Bildschirm entscheidet (KI oder Mitspieler). */
export function useOthersTurn(game: GameState): PlayerId | null {
  const me = useGameStore((state) => state.me);
  const actor = currentActor(game);
  return actor === me ? null : actor;
}

/** Ob sich der eigene letzte Schritt noch zurücknehmen lässt: niemand sonst hat seitdem gezogen. */
export function useCanUndo(game: GameState): boolean {
  const version = useGameStore((state) => state.undoVersion);
  const me = useGameStore((state) => state.me);
  return version === game.version && me !== null && currentActor(game) === me;
}
