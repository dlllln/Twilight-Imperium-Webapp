import type { DecisionContext } from '../eventsourcing/command.ts';
import type { GameState } from '../game/game-state.ts';
import type { LeadersAssigned } from './leader-events.ts';
import { factionLeaders } from './leader-queries.ts';
import { startingStatus } from './leader-state.ts';

/** PoK Spielaufbau: Jeder Spieler erhält die Anführer seiner Fraktion; nur Agenten sind bereit. */
export const leaderSetupEvents = (
  state: GameState,
  context: DecisionContext,
): readonly LeadersAssigned[] =>
  state.players.flatMap((player) => {
    const leaders = factionLeaders(context.content, player.faction).map(({ id, kind }) => ({
      id,
      kind,
      status: startingStatus(kind),
    }));
    return leaders.length === 0 ? [] : [{ type: 'LeadersAssigned', player: player.id, leaders }];
  });
