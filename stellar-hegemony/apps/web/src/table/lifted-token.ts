import type { GameState, PlayerId, SystemId } from '@stellar/domain';
import type { TableDecision } from './use-table-decision.ts';

/*
 * Kriegsführung: Der gewählte Marker ist von der Karte aufgenommen und liegt in der Schale.
 * Die Karte zeigt ihn deshalb schon vor dem Absenden nicht mehr auf seinem System, damit Karte,
 * Schale und „Auf der Karte“ dasselbe zeigen (reine Funktionen).
 */

export interface LiftedToken {
  readonly system: SystemId;
  readonly player: PlayerId;
}

/** Das System, aus dem der Entwurf der Kriegsführung einen Marker genommen hat. */
function warfareSystem(decision: TableDecision | null): SystemId | null {
  const draft = decision?.specId === 'warfare' ? decision.draft : null;
  return draft?.kind === 'tokens' ? draft.system : null;
}

/** Der Marker, den der Entwurf der Kriegsführung gerade von der Karte genommen hat. */
export function liftedTokenOf(decision: TableDecision | null): LiftedToken | null {
  const system = warfareSystem(decision);
  const player = decision?.route.actor ?? null;
  return system === null || player === null ? null : { system, player };
}

/** Der Spielstand, wie die Karte ihn zeigt: ohne den aufgenommenen Marker. */
export function withoutLifted(game: GameState, lifted: LiftedToken | null): GameState {
  const system = lifted === null ? undefined : game.systems[lifted.system];
  if (lifted === null || system === undefined) return game;
  const commandTokens = system.commandTokens.filter((player) => player !== lifted.player);
  return { ...game, systems: { ...game.systems, [lifted.system]: { ...system, commandTokens } } };
}
