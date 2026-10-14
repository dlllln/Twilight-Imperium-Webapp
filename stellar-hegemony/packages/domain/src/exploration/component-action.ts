import { timingOpen } from '../action-card/card-timing.ts';
import { endTurn } from '../action/action-commands.ts';
import type { DecisionContext } from '../eventsourcing/command.ts';
import { evolveGame, type GameEvent } from '../game/game-events.ts';
import type { GameState } from '../game/game-state.ts';
import { type Check, type DomainError, firstFailure, guard } from '../shared/domain-error.ts';
import type { PlayerId } from '../shared/ids.ts';
import { map, type Result } from '../shared/result.ts';
import type { RewardEffect } from './exploration-definition.ts';
import { rewardListEvents, rewardsUsable, type RewardSituation } from './reward-effects.ts';

export type ComponentEvents = Result<readonly GameEvent[], DomainError>;

/** RR 51: Eine Komponentenaktion beendet nach ihrer Wirkung den Zug. */
export function asComponentAction(
  state: GameState,
  player: PlayerId,
  events: readonly GameEvent[],
): readonly GameEvent[] {
  const after = events.reduce(evolveGame, state);
  return [...events, ...endTurn(after, player, after.actionPhase?.passed ?? [])];
}

/** RR 51.1: Komponentenaktionen nur als eigene Aktion; `scope` ist der Präfix der Fehlercodes. */
export const componentTiming = (state: GameState, player: PlayerId, scope: string): Check =>
  guard(timingOpen(state, player, 'action'), `${scope}.notAction`, 'Nur als eigene Aktion');

/** Belohnungen als Komponentenaktion: Quelle, Zusatzprüfungen und das Nutzungs-Event. */
export interface RewardAction {
  readonly input: RewardSituation;
  readonly rewards: readonly RewardEffect[];
  readonly checks: readonly Check[];
  readonly used: GameEvent;
  /** Präfix der Fehlercodes, z. B. `exploration` oder `leader`. */
  readonly scope: string;
}

/** Prüft Zeitpunkt, Zusatzbedingungen und Wirkung (RR 51.3), dann Nutzung, Wirkung, Zugende. */
export function rewardAction(action: RewardAction, context: DecisionContext): ComponentEvents {
  const { input, rewards, used, scope } = action;
  const checked = firstFailure([
    componentTiming(input.state, input.player, scope),
    ...action.checks,
    guard(rewardsUsable(input, rewards), `${scope}.noEffect`, 'Die Fähigkeit hätte keine Wirkung'),
  ]);
  return map(checked, () => {
    const after = evolveGame(input.state, used);
    const resolved = rewardListEvents({ ...input, state: after, random: context.random }, rewards);
    return asComponentAction(input.state, input.player, [used, ...resolved]);
  });
}
