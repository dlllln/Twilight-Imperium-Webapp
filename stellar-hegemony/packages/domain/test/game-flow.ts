import {
  decideGameCommand,
  type DecisionContext,
  evolveGame,
  factionId,
  type GameCommand,
  type GameEvent,
  type GameState,
  playerId,
  type PlayerColor,
  replayGame,
} from '../src/index.ts';
import { BLUE, CARD, config, contextWith, RED } from './fixtures.ts';

export const GREEN = playerId('green');
export const SMALL_MAP = 'center b1 b2 r1 b3 r2 b4 H . . . H . . . H';

/** Führt Commands aus und bricht beim ersten Fehler ab (nur für Testaufbauten). */
export function run(
  state: GameState,
  commands: readonly GameCommand[],
  context: DecisionContext = contextWith(),
): GameState {
  return commands.reduce((current, command) => {
    const decided = decideGameCommand(current, command, context);
    if (!decided.ok) throw new Error(`${command.type}: ${decided.error.code}`);
    return decided.value.reduce(evolveGame, current);
  }, state);
}

/** Wendet die Events eines Commands an und liefert sie mit dem neuen Zustand. */
export function step(
  state: GameState,
  command: GameCommand,
  context: DecisionContext = contextWith(),
): { readonly state: GameState; readonly events: readonly GameEvent[] } {
  const decided = decideGameCommand(state, command, context);
  if (!decided.ok) throw new Error(`${command.type}: ${decided.error.code}`);
  return { state: decided.value.reduce(evolveGame, state), events: decided.value };
}

const seat = (id: GameState['host'], color: PlayerColor): GameCommand => ({
  type: 'SeatPlayer',
  issuedBy: id,
  name: id,
  color,
  faction: factionId(`f-${id}`),
  commodityLimit: 3,
});

/** Drei Spieler im Uhrzeigersinn: Rot (Gastgeber), Blau, Grün; Galaxie importiert. */
export function setupGame(): GameState {
  const created = replayGame([
    { type: 'GameCreated', gameId: 'g' as never, host: RED, config: config(3) },
  ]);
  if (!created.ok) throw new Error('setup');
  return run(created.value, [
    seat(RED, 'red'),
    seat(BLUE, 'blue'),
    seat(GREEN, 'green'),
    { type: 'ImportMap', issuedBy: RED, mapString: SMALL_MAP },
  ]);
}

/** Partie gestartet, Sprecher Rot (Zufallswert 0). */
export const startedGame = (): GameState =>
  run(setupGame(), [{ type: 'StartGame', issuedBy: RED }]);

const pick = (player: GameState['host'], initiative: number): GameCommand => ({
  type: 'PickStrategyCard',
  issuedBy: player,
  card: CARD(initiative),
});

/** Rot hält 1 und 4, Blau 2 und 5, Grün 3 und 6; Aktionsphase läuft. */
export const actionPhaseGame = (): GameState =>
  run(startedGame(), [
    pick(RED, 1),
    pick(BLUE, 2),
    pick(GREEN, 3),
    pick(RED, 4),
    pick(BLUE, 5),
    pick(GREEN, 6),
  ]);

/** Alle Karten genutzt, alle haben gepasst: Statusphase der ersten Runde. */
export function statusPhaseGame(state: GameState = actionPhaseGame()): GameState {
  const used = {
    ...state,
    strategyCards: Object.fromEntries(
      Object.entries(state.strategyCards).map(([id, card]) => [id, { ...card, exhausted: true }]),
    ),
  };
  const pass = (issuedBy: GameState['host']): GameCommand => ({ type: 'Pass', issuedBy });
  return run(used, [pass(RED), pass(BLUE), pass(GREEN)]);
}
