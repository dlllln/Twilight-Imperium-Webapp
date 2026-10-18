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

/** Der Marker, den der Entwurf der Kriegsführung gerade von der Karte genommen hat. */
export function liftedTokenOf(decision: TableDecision | null): LiftedToken | null {
  if (decision?.specId !== 'warfare') return null;
  const system = decision.draft?.system ?? null;
  const player = decision.route.actor;
  return system === null || player === null ? null : { system, player };
}

/** Der Spielstand, wie die Karte ihn zeigt: ohne den aufgenommenen Marker. */
export function withoutLifted(game: GameState, lifted: LiftedToken | null): GameState {
  const system = lifted === null ? undefined : game.systems[lifted.system];
  if (lifted === null || system === undefined) return game;
  const commandTokens = system.commandTokens.filter((player) => player !== lifted.player);
  return { ...game, systems: { ...game.systems, [lifted.system]: { ...system, commandTokens } } };
}
