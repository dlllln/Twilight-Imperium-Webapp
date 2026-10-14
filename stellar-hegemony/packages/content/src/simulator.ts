import type { FleetRules, TacticCard, UnitTypeId } from '@stellar/domain';
import type { LocalizedText } from './localized.ts';
import { UNIT_TYPES as U } from './units.ts';
import { TI4_FACTION_PROFILES } from './official-factions.ts';

/*
 * Inhalte des Kampfsimulators: Grenzen beim Flottenbau, eigene Taktikkarten und kurze,
 * eigene Fraktionsprofile. Nichts davon stammt aus Karten oder Texten anderer Spiele.
 */

export const SIMULATOR_RULES: FleetRules & {
  /** Kämpfe einer Serie; wer die Mehrheit gewinnt, gewinnt die Serie. */
  readonly battles: number;
} = { budget: 30, productionLimit: 16, battles: 3 };

/** Schiffe, die im Simulator gebaut werden können, vom größten zum kleinsten. */
export const SIMULATOR_SHIPS: readonly UnitTypeId[] = [
  U.sunbreaker,
  U.flagship,
  U.dreadnought,
  U.cruiser,
  U.carrier,
  U.destroyer,
  U.fighter,
];

export const TACTIC_CARDS: readonly TacticCard[] = [
  { id: 'focused-fire', effect: { kind: 'combatBonus', amount: 1 } },
  { id: 'emergency-shields', effect: { kind: 'cancelHits', amount: 1 } },
  { id: 'overcharge', effect: { kind: 'extraDice', amount: 2 } },
  { id: 'field-repairs', effect: { kind: 'repair' } },
];

export interface TacticCardText {
  readonly name: LocalizedText;
  readonly effect: LocalizedText;
}

export const TACTIC_CARD_TEXTS: Readonly<Record<string, TacticCardText>> = {
  'focused-fire': {
    name: { de: 'Gebündeltes Feuer', en: 'Focused Fire' },
    effect: {
      de: '+1 auf alle deine Kampfwürfe in dieser Runde.',
      en: '+1 to all of your combat rolls this round.',
    },
  },
  'emergency-shields': {
    name: { de: 'Notschilde', en: 'Emergency Shields' },
    effect: {
      de: 'Wehre in dieser Runde 1 Treffer ab.',
      en: 'Cancel 1 hit against you this round.',
    },
  },
  overcharge: {
    name: { de: 'Überladung', en: 'Overcharge' },
    effect: {
      de: 'Dein treffsicherstes Schiff würfelt in dieser Runde 2 Würfel mehr.',
      en: 'Your most accurate ship rolls 2 more dice this round.',
    },
  },
  'field-repairs': {
    name: { de: 'Feldreparatur', en: 'Field Repairs' },
    effect: {
      de: 'Repariere vor den Würfen alle deine beschädigten Schiffe.',
      en: 'Repair all of your damaged ships before rolling.',
    },
  },
};

/** Wie anspruchsvoll eine Fraktion zu spielen ist (1 bis 3) und ein Satz eigener Hintergrund. */
export interface FactionProfile {
  readonly complexity: 1 | 2 | 3;
  readonly lore: LocalizedText;
}

export const FACTION_PROFILES: Readonly<Record<string, FactionProfile>> = {
  ...TI4_FACTION_PROFILES,
  aurel: {
    complexity: 1,
    lore: {
      de: 'Werftstädte im Orbit von Aurelis bauen mehr Schiffe, als die Liga je bemannen kann.',
      en: 'Shipyard cities orbiting Aurelis build more ships than the League can ever crew.',
    },
  },
  orun: {
    complexity: 2,
    lore: {
      de: 'Ein Chor aus Millionen Stimmen entscheidet gemeinsam, wann das Kollektiv kämpft.',
      en: 'A choir of millions decides together when the Collective goes to war.',
    },
  },
  sel: {
    complexity: 2,
    lore: {
      de: 'Der Handelsbund misst Siege in Frachtraum, nicht in zerstörten Schiffen.',
      en: 'The Trade Compact measures victories in cargo space, not in wrecks.',
    },
  },
  karth: {
    complexity: 1,
    lore: {
      de: 'Karth panzert jedes Schiff doppelt und erwartet, dass es zurückkehrt.',
      en: 'Karth armours every ship twice and expects it to come home.',
    },
  },
  nesh: {
    complexity: 3,
    lore: {
      de: 'Die Sternwacht sieht Flotten kommen, lange bevor deren Triebwerke zünden.',
      en: 'The Starwatch sees fleets coming long before their engines ignite.',
    },
  },
  quel: {
    complexity: 3,
    lore: {
      de: 'Der Schwarm ersetzt jedes verlorene Schiff durch zwei kleinere.',
      en: 'The Swarm replaces every lost ship with two smaller ones.',
    },
  },
  vyr: {
    complexity: 2,
    lore: {
      de: 'Das Archiv sammelt jede Sternkarte, und wer sie lesen will, zahlt mit Wissen.',
      en: 'The Archive collects every star chart, and whoever wants to read one pays in knowledge.',
    },
  },
  tarn: {
    complexity: 2,
    lore: {
      de: 'In den Freihäfen gilt nur ein Gesetz: Die Fracht kommt immer an.',
      en: 'The Free Ports keep a single law: the cargo always arrives.',
    },
  },
};
