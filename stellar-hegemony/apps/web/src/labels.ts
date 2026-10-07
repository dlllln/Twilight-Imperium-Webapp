import {
  actionCardText,
  agendaText,
  FACTION_NAMES,
  factionAbilityText,
  objectiveText,
  planetName,
  technologyText,
  unitName,
} from '@stellar/content';
import { type GameState, unitTypeId } from '@stellar/domain';
import type { Language } from './i18n.ts';

export const planetLabel = (id: string, language: Language): string =>
  planetName(id)?.[language] ?? id;

export const unitLabel = (type: string, language: Language): string =>
  unitName(unitTypeId(type))?.[language] ?? type;

/** „B07 · Planet A, Planet B“: Systemkennung mit den Namen seiner Planeten. */
export function systemLabel(game: GameState, id: string, language: Language): string {
  const planets = game.systems[id]?.planetIds.map((planet) => planetLabel(planet, language)) ?? [];
  return [id.toUpperCase(), planets.join(', ')].filter((part) => part !== '').join(' · ');
}

export const technologyLabel = (id: string, language: Language): string =>
  technologyText(id)?.name[language] ?? id;

export const technologyEffectText = (id: string, language: Language): string =>
  technologyText(id)?.effect[language] ?? '';

export const objectiveLabel = (id: string, language: Language): string =>
  objectiveText(id)?.name[language] ?? id;

export const objectiveRequirement = (id: string, language: Language): string =>
  objectiveText(id)?.requirement[language] ?? '';

export const actionCardLabel = (id: string, language: Language): string =>
  actionCardText(id)?.name[language] ?? id;

export const actionCardTiming = (id: string, language: Language): string =>
  actionCardText(id)?.timing[language] ?? '';

export const actionCardEffect = (id: string, language: Language): string =>
  actionCardText(id)?.effect[language] ?? '';

export const agendaLabel = (id: string, language: Language): string =>
  agendaText(id)?.name[language] ?? id;

export const agendaPassedText = (id: string, language: Language): string =>
  agendaText(id)?.passed[language] ?? '';

export const agendaRejectedText = (id: string, language: Language): string =>
  agendaText(id)?.rejected[language] ?? '';

export const factionLabel = (id: string, language: Language): string =>
  FACTION_NAMES[id]?.[language] ?? id;

export const factionAbilityLabel = (id: string, language: Language): string =>
  factionAbilityText(id)?.name[language] ?? id;

export const factionAbilityEffect = (id: string, language: Language): string =>
  factionAbilityText(id)?.effect[language] ?? '';
