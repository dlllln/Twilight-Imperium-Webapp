import { AGAINST, FOR, type GameState } from '@stellar/domain';
import type { Language, MessageKey } from '../../i18n.ts';
import { planetLabel } from '../../labels.ts';

/** Dafür/Dagegen übersetzt, Spieler mit Namen, Planeten mit ihrem Namen. */
export function outcomeLabel(
  game: GameState,
  outcome: string,
  language: Language,
  t: (key: MessageKey) => string,
): string {
  if (outcome === FOR) return t('outcome.for');
  if (outcome === AGAINST) return t('outcome.against');
  const player = game.players.find((candidate) => candidate.id === outcome);
  return player?.name ?? planetLabel(outcome, language);
}
