import type { FactionAbility } from '../faction/faction-ability.ts';
import { findPlayer, type GameState } from '../game/game-state.ts';
import type { ContentPort } from '../ports/content-port.ts';
import type { FactionId, LeaderId, PlayerId } from '../shared/ids.ts';
import type { LeaderDefinition } from './leader-definition.ts';
import type { OwnedLeader } from './leader-state.ts';

type Leaders = Pick<ContentPort, 'leaders'>;

export const findLeader = (content: Leaders, id: LeaderId): LeaderDefinition | undefined =>
  content.leaders.find((leader) => leader.id === id);

/** Anführer einer Fraktion in der Reihenfolge des Contents. */
export const factionLeaders = (content: Leaders, faction: FactionId): readonly LeaderDefinition[] =>
  content.leaders.filter((leader) => leader.faction === faction);

/** Ein Anführer des Spielers mit Zustand und Stammdaten (für Anzeige und Planer). */
export interface LeaderView extends OwnedLeader {
  readonly definition: LeaderDefinition;
}

/** PoK Anführer: alle Anführer eines Spielers samt Zustand; alles ist öffentlich. */
export function leadersOf(
  state: GameState,
  player: PlayerId,
  content: Leaders,
): readonly LeaderView[] {
  const owned = findPlayer(state, player)?.leaders ?? [];
  return owned.flatMap((leader) => {
    const definition = findLeader(content, leader.id);
    return definition === undefined ? [] : [{ ...leader, definition }];
  });
}

/** Ob ein Anführer bereit oder erschöpft ist, also nicht mehr gesperrt und nicht entfernt. */
const unlocked = (leader: OwnedLeader) =>
  leader.status === 'ready' || leader.status === 'exhausted';

/**
 * PoK Kommandant: Dauerwirkungen der freigeschalteten Kommandanten, als Fraktionsfähigkeiten
 * mit der Id des Anführers (Einheitenwerte, Regelwerte, Einsatz von Einheiten).
 */
export const commanderAbilities = (
  state: GameState,
  player: PlayerId,
  content: Leaders,
): readonly FactionAbility[] =>
  leadersOf(state, player, content)
    .filter(unlocked)
    .flatMap(({ definition }) =>
      definition.kind === 'commander' ? [{ ...definition.passive, id: definition.id }] : [],
    );
