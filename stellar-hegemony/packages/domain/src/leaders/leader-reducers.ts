import type { ReducerMap } from '../eventsourcing/domain-event.ts';
import { type GameState, updatePlayer } from '../game/game-state.ts';
import type { LeaderId, PlayerId } from '../shared/ids.ts';
import type { LeaderEvent } from './leader-events.ts';
import type { LeaderStatus, OwnedLeader } from './leader-state.ts';

const withStatus = (
  state: GameState,
  player: PlayerId,
  leader: LeaderId,
  status: LeaderStatus,
): GameState =>
  updatePlayer(state, player, (p) => ({
    ...p,
    leaders: p.leaders.map((owned) => (owned.id === leader ? { ...owned, status } : owned)),
  }));

const readied = (leader: OwnedLeader): OwnedLeader =>
  leader.status === 'exhausted' ? { ...leader, status: 'ready' } : leader;

/** PoK Statusphase: erschöpfte Agenten werden wieder bereit. */
export const readyLeaders = (state: GameState): GameState => ({
  ...state,
  players: state.players.map((player) => ({ ...player, leaders: player.leaders.map(readied) })),
});

export const leaderReducers: ReducerMap<GameState, LeaderEvent> = {
  LeadersAssigned: (state, event) =>
    updatePlayer(state, event.player, (player) => ({ ...player, leaders: event.leaders })),
  LeaderUnlocked: (state, event) => withStatus(state, event.player, event.leader, 'ready'),
  LeaderUsed: (state, event) =>
    withStatus(state, event.player, event.leader, event.purged ? 'purged' : 'exhausted'),
};
