import { timingOpen } from '../action-card/card-timing.ts';
import type { RewardEffect } from '../exploration/exploration-definition.ts';
import { rewardsUsable, type RewardSituation } from '../exploration/reward-effects.ts';
import type { GameState } from '../game/game-state.ts';
import { homeSystemIdOf } from '../objective/board-queries.ts';
import type { ContentPort } from '../ports/content-port.ts';
import type { LeaderId, PlanetId, PlayerId } from '../shared/ids.ts';
import type { LeaderDefinition } from './leader-definition.ts';
import { leadersOf } from './leader-queries.ts';

/** Erster eigener Planet im Heimatsystem; dort setzen Anführer Einheiten ein. */
export function homePlanetOf(state: GameState, player: PlayerId, content: ContentPort) {
  const home = state.systems[homeSystemIdOf(state, player, content) ?? ''];
  const planets: readonly PlanetId[] = home?.planetIds ?? [];
  return planets.find((planet) => state.planets[planet]?.controller === player) ?? null;
}

/** Lage einer Anführer-Aktion: Quelle ist der Anführer, Einsatzort der Heimatplanet. */
export const leaderSituation = (
  state: GameState,
  player: PlayerId,
  leader: LeaderId,
  content: ContentPort,
): RewardSituation => ({
  state,
  player,
  planet: homePlanetOf(state, player, content),
  source: leader,
  content,
});

/** Komponentenaktion des Anführers; Kommandanten haben keine. */
export const leaderAction = (leader: LeaderDefinition): readonly RewardEffect[] =>
  leader.kind === 'commander' ? [] : leader.action;

/** PoK Anführer: bereite Agenten und Helden, deren Aktion jetzt etwas bewirken würde. */
export function usableLeaders(
  state: GameState,
  player: PlayerId,
  content: ContentPort,
): readonly LeaderId[] {
  if (!timingOpen(state, player, 'action')) return [];
  return leadersOf(state, player, content)
    .filter((leader) => leader.status === 'ready')
    .filter(({ id, definition }) =>
      rewardsUsable(leaderSituation(state, player, id, content), leaderAction(definition)),
    )
    .map((leader) => leader.id);
}
