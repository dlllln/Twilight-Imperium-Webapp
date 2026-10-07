import { drawForAll } from '../action-card/draw.ts';
import type { Command, CommandHandler, DecisionContext } from '../eventsourcing/command.ts';
import { evolveGame, type GameEvent } from '../game/game-events.ts';
import { findPlayer, type GameState } from '../game/game-state.ts';
import { StarSystem } from '../galaxy/star-system.ts';
import { pickQueueFor } from '../phases/start-game.ts';
import { agendaPhaseEvents } from '../agenda/agenda-flow.ts';
import { factionRule } from '../faction/faction-ability.ts';
import { CommandSheet, type PoolCounts } from '../player/command-sheet.ts';
import {
  type Check,
  type DomainError,
  domainError,
  firstFailure,
  guard,
} from '../shared/domain-error.ts';
import type { PlayerId } from '../shared/ids.ts';
import { andThen, combine, err, map, ok, type Result } from '../shared/result.ts';
import { fleetLimitOf } from '../technology/technology-catalog.ts';

export type EndScoring = Command<'EndScoring'>;

export interface AllocateCommandTokens extends Command<'AllocateCommandTokens'> {
  readonly pools: PoolCounts;
}

type Events = Result<readonly GameEvent[], DomainError>;

/** Wer im laufenden Schritt der Statusphase an der Reihe ist. */
export const statusActor = (state: GameState): PlayerId | null =>
  state.statusPhase?.waiting[0] ?? null;

const stepCheck = (state: GameState, player: PlayerId, step: 'scoring' | 'tokens'): Check =>
  firstFailure([
    guard(state.statusPhase?.step === step, 'status.wrongStep', 'Dieser Schritt läuft nicht'),
    guard(statusActor(state) === player, 'status.notYourTurn', 'Du bist nicht an der Reihe'),
  ]);

/** RR 12.15/68.8: ohne verdeckten Auftrag gewinnt, wer die meisten Punkte hat. */
function winnerByPoints(state: GameState): PlayerId | null {
  const order = state.statusPhase?.order ?? [];
  const points = (id: PlayerId) => findPlayer(state, id)?.victoryPoints ?? 0;
  return (
    [...order].sort((a, b) => points(b) - points(a) || order.indexOf(a) - order.indexOf(b))[0] ??
    null
  );
}

/** Fraktionen mit Einkommen erhalten in der Statusphase Handelswaren. */
const statusIncome = (state: GameState, order: readonly PlayerId[]): readonly GameEvent[] =>
  order.flatMap((player) => {
    const amount = factionRule(state, player, 'statusTradeGoods');
    return amount > 0 ? [{ type: 'TradeGoodsGained', player, amount } as const] : [];
  });

/** RR 73.2–73.4: Auftrag aufdecken (oder Spielende), Aktionskarten ziehen, Marker vom Plan. */
function afterScoring(state: GameState, context: DecisionContext): readonly GameEvent[] {
  const next = state.objectives.public.find((slot) => !slot.revealed);
  if (next === undefined) {
    const winner = winnerByPoints(state);
    return winner === null ? [] : [{ type: 'GameWon', player: winner }];
  }
  const order = state.statusPhase?.order ?? [];
  const count = (player: PlayerId) =>
    state.config.rules.statusPhaseActionCards + factionRule(state, player, 'statusActionCards');
  return [
    { type: 'PublicObjectiveRevealed', objective: next.id },
    ...statusIncome(state, order),
    ...drawForAll(state, order, count, context.random),
    { type: 'CommandTokensCleared' },
    { type: 'TokenStepReached' },
  ];
}

export const endScoringHandler = {
  commandType: 'EndScoring',
  decide(state: GameState, command: EndScoring, context: DecisionContext): Events {
    const checked = stepCheck(state, command.issuedBy, 'scoring');
    if (!checked.ok) return checked;
    const finished: GameEvent = { type: 'ScoringFinished', player: command.issuedBy };
    const last = state.statusPhase?.waiting.length === 1;
    return ok(last ? [finished, ...afterScoring(state, context)] : [finished]);
  },
} as const satisfies CommandHandler<GameState, EndScoring, GameEvent>;

/** RR 73.8: neue Runde beginnt mit der Strategiephase ab dem Sprecher. */
export function nextRoundEvents(state: GameState): readonly GameEvent[] {
  const speaker = state.speaker ?? state.host;
  return [
    { type: 'RoundEnded' },
    {
      type: 'StrategyPhaseStarted',
      round: state.round + 1,
      pickQueue: pickQueueFor(state, speaker),
    },
  ];
}

/** RR 36.4/71.1: ohne Zentrumsmarker folgt die Agendaphase, sonst gleich die nächste Runde. */
function roundEndEvents(state: GameState, context: DecisionContext): readonly GameEvent[] {
  if (!state.centerTokenRemoved) return nextRoundEvents(state);
  const ended: GameEvent = { type: 'RoundEnded' };
  return [ended, ...agendaPhaseEvents(evolveGame(state, ended), context)];
}

/** RR 73.6 Hinweis: nach dem Umverteilen darf kein System das Flottenlimit überschreiten. */
function fleetCheck(after: GameState, player: PlayerId, context: DecisionContext): Check {
  const fleet = fleetLimitOf(after, player, context.content);
  const inspected = combine(
    Object.values(after.systems).map((system) =>
      StarSystem.inspect(
        system,
        system.planetIds.flatMap((id) => after.planets[id] ?? []),
        context.content.units,
      ),
    ),
  );
  return andThen(inspected, (systems) =>
    guard(
      !systems.some((s) => s.exceedsFleetLimit(player, fleet)),
      'status.fleetLimit',
      'Flottenlimit',
    ),
  );
}

function allocation(
  state: GameState,
  command: AllocateCommandTokens,
): Result<GameEvent, DomainError> {
  const player = findPlayer(state, command.issuedBy);
  if (player === undefined) return err(domainError('status.unknownPlayer', 'Unbekannter Spieler'));
  const tokens =
    state.config.rules.statusPhaseCommandTokens + player.factionRules.statusCommandTokens;
  const gained = Math.min(tokens, player.reinforcementTokens);
  return andThen(CommandSheet.of(player.commandPools), (sheet) =>
    map(sheet.gain('tactic', gained).redistribute(command.pools), (next) => ({
      type: 'CommandTokensAllocated',
      player: player.id,
      gained,
      pools: next.pools,
    })),
  );
}

export const allocateCommandTokensHandler = {
  commandType: 'AllocateCommandTokens',
  decide(state: GameState, command: AllocateCommandTokens, context: DecisionContext): Events {
    const checked = stepCheck(state, command.issuedBy, 'tokens');
    if (!checked.ok) return checked;
    return andThen(allocation(state, command), (allocated) => {
      const after = evolveGame(state, allocated);
      const last = state.statusPhase?.waiting.length === 1;
      return map(fleetCheck(after, command.issuedBy, context), () =>
        last ? [allocated, ...roundEndEvents(after, context)] : [allocated],
      );
    });
  },
} as const satisfies CommandHandler<GameState, AllocateCommandTokens, GameEvent>;
