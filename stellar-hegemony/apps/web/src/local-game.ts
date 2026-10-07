import {
  createGameHandler,
  decideGameCommand,
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
  tacticalDecider,
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

/** Wie `applyCommand`, liefert aber auch die Events (für Kampfansicht und Protokoll). */
export function applyCommandWithEvents(
  state: GameState,
  command: GameCommand,
  seed: number,
): Result<Applied, DomainError> {
  const context = { random: new SeededRandom(seed + state.version), now: Date.now(), content };
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

function setupCommands(layout: MapLayout, playerCount: number): readonly GameCommand[] {
  const host = seatPlayerId(0);
  const seats = Array.from({ length: playerCount }, (_, seat): GameCommand => ({
    type: 'SeatPlayer',
    issuedBy: seatPlayerId(seat),
    name: `P${String(seat + 1)}`,
    color: COLORS[seat] ?? 'black',
    faction: content.factions[seat]?.id ?? factionId('unbekannt'),
    commodityLimit: content.factions[seat]?.commodityLimit ?? 0,
  }));
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
): Result<GameState, DomainError> {
  const config = { playerCount, victoryPointsToWin: VICTORY_POINTS, rules: BASE_RULE_NUMBERS };
  const command = {
    type: 'CreateGame',
    issuedBy: seatPlayerId(0),
    gameId: gameId('lokal'),
    config,
  } as const;
  const created = andThen(createGameHandler.decide(null, command), replayGame);
  return setupCommands(layout, playerCount).reduce<Result<GameState, DomainError>>(
    (state, next) => andThen(state, (current) => applyCommand(current, next, seed)),
    created,
  );
}

/** Wer gerade am Bildschirm entscheiden muss (Hot-Seat). */
export function currentActor(state: GameState): PlayerId | null {
  if (state.phase === 'strategy') return state.pickQueue[0] ?? null;
  const turn = state.actionPhase;
  if (state.phase !== 'action' || turn === null) return null;
  return turn.secondary?.awaiting[0] ?? tacticalDecider(state) ?? turn.active;
}
