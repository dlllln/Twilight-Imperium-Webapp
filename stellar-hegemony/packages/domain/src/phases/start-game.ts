import type { Command, CommandHandler, DecisionContext } from '../eventsourcing/command.ts';
import { strategyCardsPerPlayer } from '../game/game-config.ts';
import { clockwiseFrom, type GameState } from '../game/game-state.ts';
import {
  type Check,
  type DomainError,
  domainError,
  firstFailure,
  guard,
} from '../shared/domain-error.ts';
import type { PlayerId } from '../shared/ids.ts';
import { err, map, type Result } from '../shared/result.ts';
import type { HomeSystemPlaced } from '../faction/home-events.ts';
import { homeSystemEvents } from '../faction/home-placement.ts';
import type { GameStarted, StrategyPhaseStarted } from './phase-events.ts';

export type StartGame = Command<'StartGame'>;

/** RR 76.2: ab dem Sprecher im Uhrzeigersinn, bei wenigen Spielern mehrere Durchgänge. */
export function pickQueueFor(state: GameState, speaker: PlayerId): readonly PlayerId[] {
  const round = clockwiseFrom(state, speaker).map((player) => player.id);
  return Array.from({ length: strategyCardsPerPlayer(state.config) }, () => round).flat();
}

function startChecks(state: GameState, command: StartGame, context: DecisionContext): Check {
  const { players, config, systems } = state;
  const cards = context.content.strategyCards.length;
  return firstFailure([
    guard(command.issuedBy === state.host, 'setup.hostOnly', 'Nur der Gastgeber startet'),
    guard(players.length === config.playerCount, 'setup.seatsOpen', 'Plätze sind noch frei'),
    guard(Object.keys(systems).length > 0, 'setup.noGalaxy', 'Die Galaxie fehlt noch'),
    guard(cards === config.rules.strategyCardCount, 'setup.strategyCards', 'Karten fehlen'),
  ]);
}

type StartEvent = GameStarted | HomeSystemPlaced | StrategyPhaseStarted;

const startingCards = (context: DecisionContext): GameStarted['strategyCards'] =>
  [...context.content.strategyCards]
    .sort((a, b) => a.initiative - b.initiative)
    .map(({ id, initiative, mechanic }) => ({ id, initiative, mechanic }));

/** RR 76.1 und Spielaufbau: Sprecher auslosen, Heimatsysteme legen, Strategiephase beginnen. */
export const startGameHandler = {
  commandType: 'StartGame',
  decide(
    state: GameState,
    command: StartGame,
    context: DecisionContext,
  ): Result<readonly StartEvent[], DomainError> {
    const checked = startChecks(state, command, context);
    if (!checked.ok) return checked;
    const speaker = state.players[context.random.nextInt(0, state.players.length - 1)];
    if (speaker === undefined) return err(domainError('setup.noPlayers', 'Keine Spieler'));
    return map(homeSystemEvents(state, context), (homes) => [
      { type: 'GameStarted', speaker: speaker.id, strategyCards: startingCards(context) },
      ...homes,
      { type: 'StrategyPhaseStarted', round: 1, pickQueue: pickQueueFor(state, speaker.id) },
    ]);
  },
} as const satisfies CommandHandler<GameState, StartGame, StartEvent>;
