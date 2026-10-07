import {
  missingPrerequisites,
  ownedTechnologies,
  type TechnologyDefinition,
} from '@stellar/domain';
import { type BotView, contentOf, me } from './bot-view.ts';

/** Technologien ohne fehlende Voraussetzungen, die der Spieler noch nicht besitzt (RR 80). */
export function researchable(view: BotView): readonly TechnologyDefinition[] {
  const content = contentOf(view);
  const owned = ownedTechnologies(view.state, view.player, content);
  const known = new Set(me(view).technologies);
  return content.technologies
    .filter((technology) => !known.has(technology.id))
    .filter((technology) => missingPrerequisites(owned, technology).length === 0)
    .sort((a, b) => b.prerequisites.length - a.prerequisites.length);
}
