import type { GameState, PlayerId } from '@stellar/domain';
import { canActivateNow } from '../table/legal-systems.ts';

/*
 * Welche Knöpfe über einem gewählten System erscheinen. Ob die Aktivierung erlaubt ist,
 * entscheidet die Domain selbst: der Befehl wird an einer Kopie des Spielstands erprobt.
 */

export type SystemAction = 'view' | 'activate';

/**
 * Ansehen geht immer; aktivieren nur, wenn der Spieler am Bildschirm es jetzt darf und keine
 * strategische Aktion gewählt hat (`choosing`).
 */
export function systemActions(
  game: GameState,
  actor: PlayerId | null,
  system: string,
  choosing: boolean,
): readonly SystemAction[] {
  const activate = actor !== null && canActivateNow(game, actor, system, choosing);
  return activate ? ['view', 'activate'] : ['view'];
}
