import type { FactionAbility } from '@stellar/domain';
import type { LocalizedText } from './localized.ts';
import { UNIT_TYPES as U } from './units.ts';

/*
 * Eigene Fraktionsfähigkeiten: je Fraktion zwei. Sie nutzen dieselben Bausteine wie
 * Technologien (Einheitenwerte) und wenige Regelwerte; Namen und Texte sind eigene Entwürfe.
 */
const ability = (
  id: string,
  modifiers: FactionAbility['modifiers'],
  rules: FactionAbility['rules'] = {},
): FactionAbility => ({ id, modifiers, rules });

const ONE = 1;
const TWO = 2;

export const FACTION_ABILITIES: Readonly<Record<string, readonly FactionAbility[]>> = {
  aurel: [
    ability('shipyard-league', [
      {
        target: { types: [U.orbitalDock] },
        change: { capability: { kind: 'production', bonus: TWO } },
      },
    ]),
    ability('war-bonds', [], { statusTradeGoods: ONE }),
  ],
  orun: [
    ability('choir-of-voices', [], { extraVotes: TWO }),
    ability('shared-memory', [], { statusActionCards: ONE }),
  ],
  sel: [
    ability('trade-network', [], { freeSecondaries: ['trade', 'diplomacy'] }),
    ability('merchant-council', [], { extraVotes: ONE, actionCardHandLimit: ONE }),
  ],
  karth: [
    ability('heavy-plating', [{ target: { types: [U.dreadnought] }, change: { hitOn: -ONE } }]),
    ability('iron-discipline', [], { statusCommandTokens: ONE }),
  ],
  nesh: [
    ability('watchtowers', [
      {
        target: { types: [U.orbitalBattery] },
        change: { capability: { kind: 'spaceCannon', dice: ONE } },
      },
    ]),
    ability('star-charts', [{ target: { types: [U.carrier] }, change: { move: ONE } }]),
  ],
  quel: [
    ability('swarm-tactics', [{ target: { fighters: true }, change: { hitOn: -ONE } }]),
    ability('brood-fleets', [], { fleetLimit: ONE }),
  ],
};

export const abilitiesOf = (faction: string): readonly FactionAbility[] =>
  FACTION_ABILITIES[faction] ?? [];

export interface FactionAbilityText {
  readonly name: LocalizedText;
  readonly effect: LocalizedText;
}

const text = (name: LocalizedText, effect: LocalizedText): FactionAbilityText => ({
  name,
  effect,
});

export const FACTION_ABILITY_TEXTS: Readonly<Record<string, FactionAbilityText>> = {
  'shipyard-league': text(
    { de: 'Werftverbund', en: 'Shipyard League' },
    { de: 'Deine Werften produzieren 2 Einheiten mehr.', en: 'Your docks produce 2 more units.' },
  ),
  'war-bonds': text(
    { de: 'Kriegsanleihen', en: 'War Bonds' },
    {
      de: 'In jeder Statusphase erhältst du 1 Handelsware.',
      en: 'In every status phase you gain 1 trade good.',
    },
  ),
  'choir-of-voices': text(
    { de: 'Chor der Stimmen', en: 'Choir of Voices' },
    {
      de: 'Wenn du für ein Ergebnis stimmst, gibst du 2 Stimmen zusätzlich ab.',
      en: 'When you vote for an outcome, you cast 2 additional votes.',
    },
  ),
  'shared-memory': text(
    { de: 'Geteiltes Gedächtnis', en: 'Shared Memory' },
    {
      de: 'In jeder Statusphase ziehst du 1 Aktionskarte mehr.',
      en: 'In every status phase you draw 1 more action card.',
    },
  ),
  'trade-network': text(
    { de: 'Handelsnetz', en: 'Trade Network' },
    {
      de: 'Die Sekundärfähigkeiten von Handel und Diplomatie kosten dich keinen Strategiemarker.',
      en: 'The secondary abilities of Trade and Diplomacy cost you no strategy token.',
    },
  ),
  'merchant-council': text(
    { de: 'Kaufmannsrat', en: 'Merchant Council' },
    {
      de: 'Du gibst bei Abstimmungen 1 Stimme zusätzlich ab und darfst 1 Aktionskarte mehr halten.',
      en: 'You cast 1 additional vote and may hold 1 more action card.',
    },
  ),
  'heavy-plating': text(
    { de: 'Schwere Panzerung', en: 'Heavy Plating' },
    {
      de: 'Deine Schlachtschiffe treffen bei einem um 1 niedrigeren Wurf.',
      en: 'Your dreadnoughts hit on a roll 1 lower.',
    },
  ),
  'iron-discipline': text(
    { de: 'Eiserne Disziplin', en: 'Iron Discipline' },
    {
      de: 'In jeder Statusphase erhältst du 1 Kommandomarker mehr.',
      en: 'In every status phase you gain 1 more command token.',
    },
  ),
  watchtowers: text(
    { de: 'Wachtürme', en: 'Watchtowers' },
    {
      de: 'Deine Orbitalbatterien würfeln bei der Weltraumkanone 1 Würfel mehr.',
      en: 'Your PDS roll 1 more die for space cannon.',
    },
  ),
  'star-charts': text(
    { de: 'Sternkarten', en: 'Star Charts' },
    { de: 'Deine Träger haben Bewegung +1.', en: 'Your carriers have +1 move.' },
  ),
  'swarm-tactics': text(
    { de: 'Schwarmtaktik', en: 'Swarm Tactics' },
    {
      de: 'Deine Jäger treffen bei einem um 1 niedrigeren Wurf.',
      en: 'Your fighters hit on a roll 1 lower.',
    },
  ),
  'brood-fleets': text(
    { de: 'Brutflotten', en: 'Brood Fleets' },
    { de: 'Dein Flottenlimit ist um 1 höher.', en: 'Your fleet limit is 1 higher.' },
  ),
};

export const factionAbilityText = (id: string): FactionAbilityText | undefined =>
  FACTION_ABILITY_TEXTS[id];
