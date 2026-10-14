import { createGameCommand, setupCommands } from '@stellar/application';
import { BASE_RULE_NUMBERS, FACTIONS } from '@stellar/content';
import {
  andThen,
  createGameHandler,
  currentActor,
  decideGameCommand,
  type DomainError,
  evolveGame,
  formatMapString,
  type GameCommand,
  type GameEvent,
  gameId,
  type GameState,
  isReversible,
  map,
  type MapLayout,
  type PlayerId,
  replayGame,
  type Result,
} from '@stellar/domain';
import { SeededRandom } from '@stellar/infrastructure';
import { type Remote, useGameStore } from '../src/game-store.ts';
import { content } from '../src/store.ts';

/*
 * Testtisch: Der Server als Schleife im Speicher. Im Spiel sitzt jeder Mensch an seinem eigenen
 * Gerät; für Komponententests darf der Bildschirm hier dem Spieler am Zug folgen, damit ein Test
 * alle Plätze bedienen kann, ohne mehrere Browser zu starten.
 */

interface Applied {
  readonly state: GameState;
  readonly events: readonly GameEvent[];
}

/** Zufall hängt von Seed und Version ab: dieselbe Partie würfelt beim Wiederholen gleich. */
export function applyLocally(
  state: GameState,
  command: GameCommand,
  seed: number,
): Result<Applied, DomainError> {
  const context = { random: new SeededRandom(seed + state.version), now: 0, content };
  return map(decideGameCommand(state, command, context), (events) => ({
    state: events.reduce(evolveGame, state),
    events,
  }));
}

/** Baut eine Partie mit denselben Commands auf wie der Server. */
export function createLocalGame(
  layout: MapLayout,
  playerCount: number,
  seed: number,
  picks: readonly (string | null)[] = FACTIONS.map((faction) => faction.id),
): Result<GameState, DomainError> {
  const table = {
    gameId: gameId('test'),
    config: { playerCount, victoryPointsToWin: 10, rules: BASE_RULE_NUMBERS },
    mapString: formatMapString(layout),
    names: Array.from({ length: playerCount }, (_, seat) => `P${String(seat + 1)}`),
    picks,
  };
  const created = andThen(createGameHandler.decide(null, createGameCommand(table)), replayGame);
  return setupCommands(table, content.factions).reduce<Result<GameState, DomainError>>(
    (state, next) =>
      andThen(state, (current) => map(applyLocally(current, next, seed), (done) => done.state)),
    created,
  );
}

interface TableOptions {
  readonly seed?: number;
  /** Fester eigener Platz; ohne ihn folgt der Bildschirm dem Spieler am Zug. */
  readonly me?: PlayerId;
}

/** Im Folgemodus wechselt der Bildschirm nach jedem neuen Stand zum Spieler am Zug. */
let stopFollowing: () => void = () => undefined;

function follow(enabled: boolean): void {
  stopFollowing();
  stopFollowing = enabled
    ? useGameStore.subscribe((state, before) => {
        const actor = state.game === null ? null : currentActor(state.game);
        if (state.game !== before.game && actor !== null && actor !== state.me)
          useGameStore.setState({ me: actor });
      })
    : () => undefined;
}

function loopback(seed: number): Remote {
  let undoTo: GameState | null = null;
  const store = () => useGameStore.getState();
  return {
    command: (command) => {
      const current = store().game;
      const result = current === null ? null : applyLocally(current, command, seed);
      if (result === null || !result.ok) {
        store().setError(result?.error ?? null);
        return;
      }
      undoTo = isReversible(result.value.events) ? current : null;
      store().receive(result.value);
      store().acknowledge({ version: result.value.state.version, undoable: undoTo !== null });
    },
    undo: () => {
      const me = store().me;
      if (undoTo === null || me === null) return;
      const fromVersion = undoTo.version;
      const state = { ...undoTo, version: fromVersion + 2 };
      undoTo = null;
      store().receive({ state, events: [{ type: 'StepUndone', player: me, fromVersion }] });
    },
  };
}

/** Setzt die Partie auf den Tisch; Commands laufen sofort durch die Domain. */
export function seatTable(game: GameState, options: TableOptions = {}): void {
  follow(options.me === undefined);
  const me = options.me ?? currentActor(game) ?? game.players[0]?.id ?? null;
  useGameStore.setState({ game, me, error: null, remote: loopback(options.seed ?? 7) });
}

/** Steht vom Testtisch auf: kein Folgemodus mehr, keine Partie. */
export function leaveTable(): void {
  follow(false);
  useGameStore.getState().leave();
}
