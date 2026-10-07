import { planetName, unitName } from '@stellar/content';
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
