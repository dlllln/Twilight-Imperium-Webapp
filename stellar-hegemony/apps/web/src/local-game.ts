import {
  createGameHandler,
  decideGameCommand,
  type DecisionContext,
  type DomainError,
  evolveGame,
  factionId,
  formatMapString,
  gameId,
  type GameCommand,
  type GameState,
  type MapLayout,
  type PlayerColor,
  playerId,
  type PlayerId,
  replayGame,
  type GameEvent,
  type Result,
  andThen,
  map,
} from '@stellar/domain';
import { BASE_RULE_NUMBERS } from '@stellar/content';
import { SeededRandom } from '@stellar/infrastructure';
import { content } from './store.ts';

/** Feste Farbreihenfolge der Plätze, passend zu den Heimat-Markierungen der Karte. */
const COLORS: readonly PlayerColor[] = ['orange', 'blue', 'green', 'yellow', 'purple', 'red'];
const VICTORY_POINTS = 10;

export const seatPlayerId = (seat: number): PlayerId => playerId(`p${String(seat + 1)}`);

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

function seatCommand(seat: number, bots: readonly PlayerId[]): GameCommand {
  const id = seatPlayerId(seat);
  return {
    type: 'SeatPlayer',
    issuedBy: id,
    name: `${bots.includes(id) ? 'KI' : 'P'}${String(seat + 1)}`,
    color: COLORS[seat] ?? 'black',
    faction: content.factions[seat]?.id ?? factionId('unbekannt'),
    commodityLimit: content.factions[seat]?.commodityLimit ?? 0,
  };
}

function setupCommands(
  layout: MapLayout,
  playerCount: number,
  botCount: number,
): readonly GameCommand[] {
  const host = seatPlayerId(0);
  const bots = botSeats(playerCount, botCount);
  const seats = Array.from({ length: playerCount }, (_, seat) => seatCommand(seat, bots));
  return [
    ...seats,
    { type: 'ImportMap', issuedBy: host, mapString: formatMapString(layout) },
    { type: 'StartGame', issuedBy: host },
  ];
}

/** Erstellt die Partie, besetzt alle Plätze, übernimmt die Galaxie und startet. */
export function createLocalGame(
  layout: MapLayout,
  playerCount: number,
  seed: number,
  botCount = 0,
): Result<GameState, DomainError> {
  const config = { playerCount, victoryPointsToWin: VICTORY_POINTS, rules: BASE_RULE_NUMBERS };
  const command = {
    type: 'CreateGame',
    issuedBy: seatPlayerId(0),
    gameId: gameId('lokal'),
    config,
  } as const;
  const created = andThen(createGameHandler.decide(null, command), replayGame);
  return setupCommands(layout, playerCount, botCount).reduce<Result<GameState, DomainError>>(
    (state, next) => andThen(state, (current) => applyCommand(current, next, seed)),
    created,
  );
}

/** Wer gerade am Bildschirm entscheiden muss (Hot-Seat); dieselbe Stelle wie für Bots. */
export { currentActor } from '@stellar/domain';
