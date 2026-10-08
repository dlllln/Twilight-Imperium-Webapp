import { createGameCommand, seatPlayerId, setupCommands } from '@stellar/application';
import {
  createGameHandler,
  decideGameCommand,
  type DecisionContext,
  type DomainError,
  evolveGame,
  gameId,
  type GameCommand,
  type GameState,
  type MapLayout,
  formatMapString,
  type PlayerId,
  replayGame,
  type GameEvent,
  type Result,
  andThen,
  map,
} from '@stellar/domain';
import { BASE_RULE_NUMBERS } from '@stellar/content';
import { SeededRandom } from '@stellar/infrastructure';
import { seatFactions } from './setup/faction-draft.ts';
import { content } from './store.ts';

const VICTORY_POINTS = 10;

export { seatPlayerId };

/**
 * Lokales Hot-Seat-Spiel: dieselbe Domain wie der Server, nur ohne Netzwerk.
 * Alle Commands laufen über `decideGameCommand`, das Ergebnis über `evolveGame`.
 */
export interface Applied {
  readonly state: GameState;
  readonly events: readonly GameEvent[];
}

/** Zufall hängt von Seed und Version ab: dieselbe Partie würfelt beim Wiederholen gleich. */
export const decisionContext = (state: GameState, seed: number): DecisionContext => ({
  random: new SeededRandom(seed + state.version),
  now: Date.now(),
  content,
});

/** Wie `applyCommand`, liefert aber auch die Events (für Kampfansicht und Protokoll). */
export function applyCommandWithEvents(
  state: GameState,
  command: GameCommand,
  seed: number,
): Result<Applied, DomainError> {
  const context = decisionContext(state, seed);
  return map(decideGameCommand(state, command, context), (events) => ({
    state: events.reduce(evolveGame, state),
    events,
  }));
}

export const applyCommand = (
  state: GameState,
  command: GameCommand,
  seed: number,
): Result<GameState, DomainError> =>
  map(applyCommandWithEvents(state, command, seed), (applied) => applied.state);

/** KI-Gegner sitzen auf den letzten Plätzen; der Gastgeber ist immer ein Mensch. */
export const botSeats = (playerCount: number, botCount: number): readonly PlayerId[] =>
  Array.from({ length: playerCount }, (_, seat) => seat)
    .slice(Math.max(1, playerCount - botCount))
    .map(seatPlayerId);

const seatNames = (playerCount: number, bots: readonly PlayerId[]): readonly string[] =>
  Array.from({ length: playerCount }, (_, seat) => {
    const prefix = bots.includes(seatPlayerId(seat)) ? 'KI' : 'P';
    return `${prefix}${String(seat + 1)}`;
  });

/** Erstellt die Partie, besetzt alle Plätze mit den gewählten Fraktionen, übernimmt die Galaxie und startet. */
export function createLocalGame(
  layout: MapLayout,
  playerCount: number,
  seed: number,
  botCount = 0,
  factionPicks: readonly string[] = [],
): Result<GameState, DomainError> {
  const table = {
    gameId: gameId('lokal'),
    config: { playerCount, victoryPointsToWin: VICTORY_POINTS, rules: BASE_RULE_NUMBERS },
    mapString: formatMapString(layout),
    names: seatNames(playerCount, botSeats(playerCount, botCount)),
  };
  const created = andThen(createGameHandler.decide(null, createGameCommand(table)), replayGame);
  const factions = seatFactions(content.factions, factionPicks);
  return setupCommands(table, factions).reduce<Result<GameState, DomainError>>(
    (state, next) => andThen(state, (current) => applyCommand(current, next, seed)),
    created,
  );
}

/** Wer gerade am Bildschirm entscheiden muss (Hot-Seat); dieselbe Stelle wie für Bots. */
export { currentActor } from '@stellar/domain';
