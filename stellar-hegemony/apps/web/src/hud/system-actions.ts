import { type GameState, type PlayerId, systemId } from '@stellar/domain';
import { freeTurn, interrupted } from '../hand/hand-model.ts';
import { tryCommand } from '../rules-preview.ts';

/*
 * Welche Knöpfe über einem gewählten System erscheinen. Ob die Aktivierung erlaubt ist,
 * entscheidet die Domain selbst: der Befehl wird an einer Kopie des Spielstands erprobt.
 */

export type SystemAction = 'view' | 'activate';

function canActivate(game: GameState, actor: PlayerId, system: string): boolean {
  if (game.phase !== 'action' || !freeTurn(game) || interrupted(game, actor)) return false;
  const command = { type: 'ActivateSystem', issuedBy: actor, system: systemId(system) } as const;
  return tryCommand(game, command).ok;
}

/** Ansehen geht immer; aktivieren nur, wenn der Spieler am Bildschirm es jetzt darf. */
export function systemActions(
  game: GameState,
  actor: PlayerId | null,
  system: string,
): readonly SystemAction[] {
  const activate = actor !== null && canActivate(game, actor, system);
  return activate ? ['view', 'activate'] : ['view'];
}
