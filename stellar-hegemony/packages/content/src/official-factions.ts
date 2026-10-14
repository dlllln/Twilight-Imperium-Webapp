import {
  factionId,
  planetId,
  technologyId,
  unitTypeId,
  type FactionDefinition,
} from '@stellar/domain';
import { abilitiesOf } from './faction-abilities.ts';
import { OFFICIAL_FACTION_DATA } from './official-faction-data.ts';
import type { OfficialFactionSeed } from './official-faction-model.ts';
import { homeTile } from './systems.ts';

const planetKey = (faction: string, alias: string) => `${faction}-${alias}`;
const stacks = (values: readonly (readonly [string, number])[]) =>
  values.map(([type, count]) => ({ type: unitTypeId(type), count }));

const homeOf = (seed: OfficialFactionSeed) =>
  homeTile(
    `home-${seed.id}`,
    ...seed.home.map((planet) => ({
      name: planet.name,
      id: planetKey(seed.id, planet.alias),
      resources: planet.resources,
      influence: planet.influence,
    })),
  );

const forcesOf = (seed: OfficialFactionSeed) => ({
  space: stacks(seed.space),
  planets: seed.ground.map((entry) => ({
    planet: planetId(planetKey(seed.id, entry.planet)),
    units: stacks(entry.units),
  })),
});

function definition(seed: OfficialFactionSeed): FactionDefinition {
  return {
    id: factionId(seed.id),
    homeSystem: homeOf(seed),
    startingForces: forcesOf(seed),
    commodityLimit: seed.commodities,
    startingTechnologies: seed.technologies.map(technologyId),
    abilities: abilitiesOf(seed.id),
  };
}

/** The 30 official standard factions; legacy save IDs are kept separately. */
export const TI4_FACTIONS: readonly FactionDefinition[] = OFFICIAL_FACTION_DATA.map(definition);
export const TI4_FACTION_METADATA = Object.fromEntries(
  OFFICIAL_FACTION_DATA.map((seed) => [seed.id, seed]),
);
export const TI4_FACTION_NAMES = Object.fromEntries(
  OFFICIAL_FACTION_DATA.map((seed) => [seed.id, seed.name]),
);
export const TI4_FACTION_PROFILES = Object.fromEntries(
  OFFICIAL_FACTION_DATA.map((seed) => [
    seed.id,
    {
      complexity: seed.complexity,
      lore: {
        de: `${seed.name.de} · ${seed.home.map((planet) => planet.name).join(', ')}. Die Original-Fraktionsbögen zeigen die vollständigen Sonderregeln; die Webapp verwendet angepasste Fähigkeiten.`,
        en: `${seed.name.en} · ${seed.home.map((planet) => planet.name).join(', ')}. The original faction sheets show the complete special rules; this web app uses adapted abilities.`,
      },
    },
  ]),
);
