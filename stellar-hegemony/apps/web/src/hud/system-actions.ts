import { canExploreFrontier, type GameState, type PlayerId } from '@stellar/domain';
import { content } from '../store.ts';
import { canActivateNow } from '../table/legal-systems.ts';

/*
 * Welche Knöpfe über einem gewählten System erscheinen. Ob die Aktivierung erlaubt ist,
 * entscheidet die Domain selbst: der Befehl wird an einer Kopie des Spielstands erprobt.
 */

export type SystemAction = 'view' | 'activate' | 'explore';

/**
 * Tischansicht: Am Ende der eigenen taktischen Aktion liegt über dem aktivierten System der
 * Knopf „Grenzmarker erkunden“, wenn die Domain es erlaubt.
 */
function explorable(game: GameState, actor: PlayerId | null, system: string): boolean {
  const tactical = game.actionPhase?.tactical;
  if (actor === null || tactical?.system !== system || tactical.step !== 'done') return false;
  return game.actionPhase?.active === actor && canExploreFrontier(game, actor, content);
}

/**
 * Ansehen geht immer; aktivieren nur, wenn der Spieler am Bildschirm es jetzt darf und keine
 * strategische Aktion gewählt hat (`choosing`). In der Tischansicht (`table`) kommt am Ende der
 * taktischen Aktion das Erkunden des Grenzmarkers dazu.
 */
export function systemActions(
  game: GameState,
  actor: PlayerId | null,
  system: string,
  choosing: boolean,
  table = false,
): readonly SystemAction[] {
  const activate = actor !== null && canActivateNow(game, actor, system, choosing);
  const base: readonly SystemAction[] = activate ? ['view', 'activate'] : ['view'];
  return table && explorable(game, actor, system) ? [...base, 'explore'] : base;
}
