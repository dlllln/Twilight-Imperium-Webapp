import type { CSSProperties } from 'react';
import type {
  ExplorationDeckKind,
  FragmentKind,
  StrategyMechanic,
  TechnologyColor,
} from '@stellar/domain';

/** A crop is measured in fractions of one card, never of the entire atlas. */
export interface CardCrop {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface CardArtworkSource {
  readonly path: string;
  readonly columns: number;
  readonly rows: number;
  readonly index: number;
  readonly crop?: CardCrop;
}

const image = (path: string, crop?: CardCrop): CardArtworkSource => ({
  path: `/ti4/cards/${path}`,
  columns: 1,
  rows: 1,
  index: 0,
  ...(crop === undefined ? {} : { crop }),
});

const sheet = (path: string, columns: number, rows: number, index: number): CardArtworkSource => ({
  path: `/ti4/cards/${path}.jpg`,
  columns,
  rows,
  index,
});

const STRATEGIES: Readonly<Record<StrategyMechanic, number>> = {
  commandTokens: 1,
  diplomacy: 2,
  politics: 3,
  construction: 4,
  trade: 5,
  warfare: 6,
  technology: 7,
  imperial: 8,
};

/** The original numeric emblem, clear of the printed rules on the left. */
const STRATEGY_EMBLEM: CardCrop = { x: 0.66, y: 0.54, width: 0.32, height: 0.42 };
const PORTRAIT_MARK: CardCrop = { x: 0.13, y: 0.27, width: 0.74, height: 0.493 };

export const strategyFrame = (mechanic: StrategyMechanic): CardArtworkSource =>
  image(`strategy/${String(STRATEGIES[mechanic])}.png`);

export const strategyArtwork = (mechanic: StrategyMechanic): CardArtworkSource =>
  image(`strategy/${String(STRATEGIES[mechanic])}.png`, STRATEGY_EMBLEM);

export const ACTION_BACK = image('action-back.jpg', PORTRAIT_MARK);
export const AGENDA_BACK = image('agenda-back.jpg', PORTRAIT_MARK);

/*
 * Stellarium has its own card names and effects. These matches select authentic TI4
 * frames with a related theme; UI copy covers ALL printed titles and rules. They
 * do not change IDs, definitions or pretend that a custom card is an official one.
 * Indices and atlas dimensions are from TI4-TTPG's base card template JSON files.
 */
const ACTION_INDICES: Readonly<Record<string, number>> = {
  'black-market': 40,
  'supply-convoy': 58,
  reactivation: 15,
  'command-reserve': 69,
  recall: 73,
  recruitment: 25,
  intelligence: 68,
  unrest: 76,
  'letter-of-marque': 51,
  'commando-raid': 46,
  'dock-shift': 16,
  'trade-mission': 72,
  counterplay: 54,
  mobilization: 25,
  'combat-drill': 41,
  'evasive-maneuvers': 59,
  entrenchment: 3,
  'landing-drill': 19,
  'free-rider': 71,
};

export const actionFrame = (id: string): CardArtworkSource =>
  sheet('action', 12, 7, ACTION_INDICES[id] ?? 0);

const AGENDA_INDICES: Readonly<Record<string, number>> = {
  'trade-charter': 17,
  'card-quota': 10,
  'extended-briefings': 21,
  'command-reform': 11,
  'nebula-corridors': 32,
  'sealed-archive': 1,
  'council-seat': 5,
  'star-chancellor': 31,
  'merchant-guild': 17,
  'stimulus-package': 8,
  audit: 8,
  'medal-of-honor': 31,
  'data-leak': 3,
  'secret-mandate': 1,
  'general-mobilization': 2,
  'grid-failure': 0,
  'colonial-survey': 4,
  'orbital-cleanup': 6,
  amnesty: 34,
  reparations: 6,
  'constitutional-reform': 26,
  conscription: 30,
  'fleet-review': 2,
  tribunal: 28,
};

export const agendaFrame = (id: string): CardArtworkSource =>
  sheet('agenda', 12, 4, AGENDA_INDICES[id] ?? 0);

const PUBLIC_ONE: Readonly<Record<string, number>> = {
  'settled-reach': 4,
  'three-cultures': 0,
  'merchant-reserve': 8,
  'war-chest': 3,
  'courtly-favour': 9,
  'twin-disciplines': 2,
  'refitted-fleet': 1,
  'built-frontier': 4,
  'wild-space': 6,
  'throne-watch': 6,
};

const PUBLIC_TWO: Readonly<Record<string, number>> = {
  'sprawling-domain': 8,
  'woven-peoples': 9,
  'trade-dynasty': 0,
  'grand-treasury': 3,
  'hall-of-voices': 5,
  'four-pillars': 6,
  'modern-armada': 7,
  'fortified-realm': 8,
  'seat-of-power': 1,
  'learned-worlds': 2,
};

const SECRET: Readonly<Record<string, number>> = {
  'harsh-frontier': 13,
  'forge-worlds': 14,
  'cradle-worlds': 6,
  'single-minded': 12,
  'gun-line': 5,
  'shipwright-guild': 8,
  'storm-riders': 10,
  'iron-fist': 9,
  'swarm-doctrine': 9,
  'scholar-worlds': 12,
  hoarder: 14,
  'at-the-gates': 17,
  foothold: 17,
  'crowned-world': 15,
  'grand-fleet': 9,
  'long-reach': 2,
  'fleet-breaker': 16,
  'bloody-harvest': 4,
  'lightning-campaign': 11,
  'boots-on-ground': 16,
};

export function objectiveFrame(
  id: string,
  category: string,
  stage: number | null,
): CardArtworkSource {
  if (category === 'secret') return sheet('objective-secret', 12, 2, SECRET[id] ?? 0);
  if (stage === 2) return sheet('objective-public2', 6, 2, PUBLIC_TWO[id] ?? 0);
  return sheet('objective-public1', 6, 2, PUBLIC_ONE[id] ?? 0);
}

export const objectiveArtwork = (category: string, stage: number | null): CardArtworkSource =>
  image(`objective-${category === 'secret' ? 'secret' : `public${String(stage ?? 1)}`}-back.jpg`);

const TECH_DECKS: Readonly<Record<TechnologyColor, string>> = {
  biotic: 'green',
  propulsion: 'blue',
  cybernetic: 'yellow',
  warfare: 'red',
};

export const technologyArtwork = (color: TechnologyColor | null): CardArtworkSource =>
  image(`technology-${color === null ? 'unit' : TECH_DECKS[color]}-back.jpg`);

const TECH_INDICES: Readonly<Record<string, readonly [string, number, number, number]>> = {
  'cell-regeneration': ['green', 4, 3, 0],
  'brood-chambers': ['green', 4, 3, 2],
  'symbiotic-armour': ['green', 4, 3, 7],
  'living-shipyards': ['green', 4, 3, 5],
  'ion-drive': ['blue', 8, 1, 0],
  'expanded-holds': ['blue', 8, 1, 2],
  'fold-drive': ['blue', 8, 1, 3],
  'fleet-coordination': ['blue', 8, 1, 1],
  'target-acquisition': ['yellow', 8, 2, 0],
  'orbital-sensors': ['yellow', 8, 2, 0],
  'hangar-automation': ['yellow', 8, 2, 2],
  'battle-computers': ['yellow', 8, 2, 1],
  'reactive-plating': ['red', 8, 1, 1],
  'bunker-works': ['red', 8, 1, 2],
  'penetrator-shells': ['red', 8, 1, 3],
  'assault-doctrine': ['red', 8, 1, 0],
  'heavy-carrier': ['unit', 8, 3, 0],
  'strike-cruiser': ['unit', 8, 3, 1],
  'interceptor-destroyer': ['unit', 8, 3, 2],
  'bastion-battleship': ['unit', 8, 3, 3],
  'swarm-fighter': ['unit', 8, 3, 4],
  'veteran-infantry': ['unit', 8, 3, 5],
  'fortress-battery': ['unit', 8, 3, 6],
  'grand-dock': ['unit', 8, 3, 7],
  'sunbreaker-blueprint': ['unit', 8, 3, 8],
};

export function technologyFrame(id: string): CardArtworkSource {
  const [deck, columns, rows, index] = TECH_INDICES[id] ?? ['blue', 8, 1, 0];
  return sheet(`technology-${deck}`, columns, rows, index);
}

export const RELIC_DECK_BACK = image('relic-back.jpg');
export const RELIC_BACK = image('relic-back.jpg', PORTRAIT_MARK);

const RELIC_INDICES: Readonly<Record<string, number>> = {
  'seal-of-the-first-empress': 3,
  'command-core': 2,
  'archive-of-the-fallen': 5,
  'wanderers-star-chart': 0,
  'war-banner': 7,
  'seed-capsule': 1,
  'trade-prism': 6,
  'mending-swarm': 9,
};

export const relicFrame = (id: string): CardArtworkSource =>
  sheet('relic', 6, 2, RELIC_INDICES[id] ?? 0);

export const explorationArtwork = (deck: ExplorationDeckKind): CardArtworkSource =>
  image(`exploration-${deck}-back.jpg`);

const EXPLORATION_INDICES: Readonly<Record<string, number>> = {
  'poets-archive': 18,
  'ancient-amphitheatre': 10,
  'pilgrim-caravan': 11,
  'welcoming-envoys': 11,
  'whispering-murals': 19,
  'volunteer-militia': 15,
  'culture-shard': 0,
  'rich-ore-veins': 15,
  'toxic-bloom-lab': 14,
  'crashed-warship': 19,
  'salvage-field': 0,
  'dormant-war-machine': 13,
  'hardened-survivors': 13,
  'smugglers-hideout': 3,
  'hazard-shard': 6,
  'automated-foundry': 15,
  'orbital-relay': 5,
  'drive-test-site': 19,
  'surplus-depot': 0,
  'freight-contract': 6,
  'plant-guard': 15,
  'industrial-espionage': 6,
  'industry-shard': 10,
  'derelict-depot': 0,
  'drifting-wreck': 0,
  'lost-courier': 6,
  'nebula-harvest': 8,
  'old-beacon': 4,
  'star-shard': 11,
};

export const explorationFrame = (id: string, deck: ExplorationDeckKind): CardArtworkSource =>
  sheet(`exploration-${deck}`, 12, 2, EXPLORATION_INDICES[id] ?? 0);

const FRAGMENT_INDICES: Readonly<Record<FragmentKind, number>> = {
  cultural: 0,
  hazardous: 6,
  industrial: 10,
  frontier: 11,
};
const FRAGMENT_ART: CardCrop = { x: 0.1, y: 0.21, width: 0.8, height: 0.3 };

export const fragmentFrame = (kind: FragmentKind): CardArtworkSource =>
  sheet(`exploration-${kind}`, 12, 2, FRAGMENT_INDICES[kind]);

/** The actual colored relic shard illustration, excluding its title and rules. */
export const fragmentArtwork = (kind: FragmentKind): CardArtworkSource => ({
  ...fragmentFrame(kind),
  crop: FRAGMENT_ART,
});

const LEGENDARY_INDICES: Readonly<Record<string, number>> = { elysar: 3, morgantis: 1 };
const LEGENDARY_ART: CardCrop = { x: 0.07, y: 0.08, width: 0.83, height: 0.72 };

export const legendaryFrame = (planet: string): CardArtworkSource =>
  sheet('legendary', 4, 1, LEGENDARY_INDICES[planet] ?? 3);

/** Genuine legendary planet painting; its official name is outside this crop. */
export const legendaryArtwork = (planet: string): CardArtworkSource => ({
  ...sheet('legendary-back', 4, 1, LEGENDARY_INDICES[planet] ?? 3),
  crop: LEGENDARY_ART,
});

/** Absolute image geometry extracts ONE atlas cell, then its optional illustration. */
export function cardImageStyle(source: CardArtworkSource): CSSProperties {
  const crop = source.crop ?? { x: 0, y: 0, width: 1, height: 1 };
  const column = source.index % source.columns;
  const row = Math.floor(source.index / source.columns);
  return {
    width: `${(source.columns / crop.width) * 100}%`,
    height: `${(source.rows / crop.height) * 100}%`,
    left: `${-((column + crop.x) / crop.width) * 100}%`,
    top: `${-((row + crop.y) / crop.height) * 100}%`,
  };
}
