import type { Command, CommandHandler, DecisionContext } from '../eventsourcing/command.ts';
import { type ComponentEvents, rewardAction } from '../exploration/component-action.ts';
import type { GameEvent } from '../game/game-events.ts';
import { findPlayer, type GameState } from '../game/game-state.ts';
import { domainError, guard } from '../shared/domain-error.ts';
import type { LeaderId } from '../shared/ids.ts';
import { err } from '../shared/result.ts';
import { leaderAction, leaderSituation } from './leader-actions.ts';
import { findLeader } from './leader-queries.ts';
import type { LeaderStatus } from './leader-state.ts';

/** PoK Anführer: Komponentenaktion eines eigenen Agenten oder Helden. */
export interface UseLeader extends Command<'UseLeader'> {
  readonly leader: LeaderId;
}

const STATUS_ERRORS: Readonly<Record<Exclude<LeaderStatus, 'ready'>, string>> = {
  locked: 'Der Anführer ist noch gesperrt',
  exhausted: 'Der Anführer ist erschöpft',
  purged: 'Der Anführer ist aus dem Spiel',
};

/** Besitz und Bereitschaft; der Fehlercode nennt den Zustand (z. B. `leader.exhausted`). */
function readiness(status: LeaderStatus | undefined) {
  if (status === undefined) return [guard(false, 'leader.notOwned', 'Nicht dein Anführer')];
  if (status === 'ready') return [];
  return [guard(false, `leader.${status}`, STATUS_ERRORS[status])];
}

export const useLeaderHandler = {
  commandType: 'UseLeader',
  decide(state: GameState, command: UseLeader, context: DecisionContext): ComponentEvents {
    const { issuedBy: player, leader } = command;
    const definition = findLeader(context.content, leader);
    if (definition === undefined || definition.kind === 'commander')
      return err(domainError('leader.noAction', 'Dieser Anführer hat keine Aktion'));
    const owned = findPlayer(state, player)?.leaders.find((candidate) => candidate.id === leader);
    const input = leaderSituation(state, player, leader, context.content);
    const purged = definition.kind === 'hero';
    const used: GameEvent = { type: 'LeaderUsed', player, leader, purged };
    const checks = readiness(owned?.status);
    const rewards = leaderAction(definition);
    return rewardAction({ input, rewards, checks, used, scope: 'leader' }, context);
  },
} as const satisfies CommandHandler<GameState, UseLeader, GameEvent>;
