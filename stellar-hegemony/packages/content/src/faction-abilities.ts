import type { FactionAbility } from '@stellar/domain';
import type { LocalizedText } from './localized.ts';
import { UNIT_TYPES as U } from './units.ts';
import { OFFICIAL_FACTION_DATA } from './official-faction-data.ts';

/*
 * Eigene Fraktionsfähigkeiten: je Fraktion zwei (acht Fraktionen). Sie nutzen dieselben Bausteine wie
 * Technologien (Einheitenwerte) und wenige Regelwerte; Namen und Texte sind eigene Entwürfe.
 */
const ability = (
  id: string,
  modifiers: FactionAbility['modifiers'],
  rules: FactionAbility['rules'] = {},
): FactionAbility => ({ id, modifiers, rules });

const ONE = 1;
const TWO = 2;
const THREE = 3;
/** Weltraumkanone der Wächter-Mechs: trifft bei 8, ein Würfel, nur das eigene System. */
const SENTINEL_CANNON = { hitOn: 8, dice: 1 };

const MECH = { types: [U.mech] };

/*
 * Erweiterung (PoK Mech): Jede Fraktion hat genau eine eigene Mech-Fähigkeit. Sie ist die
 * dritte Fähigkeit der Fraktion; `mechAbilityOf` findet sie für Anzeige und Tests.
 */
const MECH_ABILITIES: Readonly<Record<string, FactionAbility>> = {
  aurel: ability('twin-mounts', [{ target: MECH, change: { dice: ONE } }]),
  orun: ability('warding-song', [{ target: MECH, change: { add: [{ kind: 'planetaryShield' }] } }]),
  sel: ability('contract-walkers', [
    { target: MECH, change: { set: { cost: { resources: ONE, unitsPerCost: ONE } } } },
  ]),
  karth: {
    ...ability('beachhead', []),
    deploy: { unit: U.mech, trigger: { kind: 'planetCaptured' } },
  },
  nesh: ability('sentinel-frames', [
    {
      target: MECH,
      change: { add: [{ kind: 'spaceCannon', profile: SENTINEL_CANNON, range: 0 }] },
    },
  ]),
  quel: {
    ...ability('brood-walkers', []),
    deploy: { unit: U.mech, trigger: { kind: 'groundForcesProduced', minimum: THREE } },
  },
  vyr: ability('lorekeeper-frames', [{ target: MECH, change: { hitOn: -ONE } }]),
  tarn: ability('forge-walkers', [
    {
      target: MECH,
      change: { add: [{ kind: 'production', bonus: ONE, addsPlanetResources: false }] },
    },
  ]),
};

const withMech = (faction: string, abilities: readonly FactionAbility[]) => {
  const mech = MECH_ABILITIES[faction];
  return mech === undefined ? abilities : [...abilities, mech];
};

const BASE_ABILITIES: Readonly<Record<string, readonly FactionAbility[]>> = {
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
  vyr: [
    ability('open-stacks', [], { freeSecondaries: ['technology'] }),
    ability('scholars-council', [], { actionCardHandLimit: TWO, extraVotes: ONE }),
  ],
  tarn: [
    ability('blockade-runners', [
      { target: { types: [U.cruiser] }, change: { move: ONE, hitOn: -ONE } },
    ]),
    ability('free-harbours', [], { freeSecondaries: ['trade'], statusTradeGoods: ONE }),
  ],
};

/** Alle Fähigkeiten je Fraktion: zwei aus dem Grundspiel, dazu die Mech-Fähigkeit. */
export const FACTION_ABILITIES: Readonly<Record<string, readonly FactionAbility[]>> =
  Object.fromEntries(
    Object.entries(BASE_ABILITIES).map(([faction, abilities]) => [
      faction,
      withMech(faction, abilities),
    ]),
  );

const OFFICIAL_ABILITIES: Readonly<Record<string, readonly FactionAbility[]>> = Object.fromEntries(
  OFFICIAL_FACTION_DATA.map((seed) => [
    seed.id,
    (FACTION_ABILITIES[seed.archetype] ?? []).map((entry) => ({
      ...entry,
      id: `ti4:${seed.id}:${entry.id}`,
    })),
  ]),
);

export const abilitiesOf = (faction: string): readonly FactionAbility[] =>
  OFFICIAL_ABILITIES[faction] ?? FACTION_ABILITIES[faction] ?? [];

/** Die Mech-Fähigkeit einer Fraktion (Erweiterung), falls sie eine hat. */
export const mechAbilityOf = (faction: string): FactionAbility | undefined =>
  OFFICIAL_ABILITIES[faction]?.at(-1) ?? MECH_ABILITIES[faction];

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
  'twin-mounts': text(
    { de: 'Doppellafetten', en: 'Twin Mounts' },
    {
      de: 'Mech: Deine Mechs würfeln im Kampf 1 Würfel mehr.',
      en: 'Mech: Your mechs roll 1 additional die in combat.',
    },
  ),
  'warding-song': text(
    { de: 'Schutzgesang', en: 'Warding Song' },
    {
      de: 'Mech: Deine Mechs haben Planetaren Schild. Ein Planet mit deinem Mech kann nicht bombardiert werden.',
      en: 'Mech: Your mechs have planetary shield. A planet with your mech cannot be bombarded.',
    },
  ),
  'contract-walkers': text(
    { de: 'Vertragsläufer', en: 'Contract Walkers' },
    {
      de: 'Mech: Deine Mechs kosten nur 1 Ressource.',
      en: 'Mech: Your mechs cost only 1 resource.',
    },
  ),
  beachhead: text(
    { de: 'Brückenkopf', en: 'Beachhead' },
    {
      de: 'Mech: Übernimmst du bei einem Einmarsch einen Planeten, den ein anderer Spieler kontrolliert hat, kommt 1 Mech aus deiner Verstärkung kostenlos auf diesen Planeten.',
      en: 'Mech: When you take over a planet another player controlled during an invasion, 1 mech from your reinforcements is placed on that planet for free.',
    },
  ),
  'sentinel-frames': text(
    { de: 'Wächterrahmen', en: 'Sentinel Frames' },
    {
      de: 'Mech: Deine Mechs haben Weltraumkanone 8 (nur im eigenen System).',
      en: 'Mech: Your mechs have space cannon 8 (own system only).',
    },
  ),
  'brood-walkers': text(
    { de: 'Brutläufer', en: 'Brood Walkers' },
    {
      de: 'Mech: Produzierst du auf einmal mindestens 3 Bodentruppen, kommt zusätzlich 1 Mech aus deiner Verstärkung kostenlos auf denselben Planeten.',
      en: 'Mech: When you produce at least 3 ground forces at once, 1 additional mech from your reinforcements is placed on the same planet for free.',
    },
  ),
  'open-stacks': text(
    { de: 'Offene Bestände', en: 'Open Stacks' },
    {
      de: 'Die Sekundärfähigkeit der Technologie kostet dich keinen Strategiemarker.',
      en: 'The secondary ability of Technology costs you no strategy token.',
    },
  ),
  'scholars-council': text(
    { de: 'Gelehrtenrat', en: "Scholars' Council" },
    {
      de: 'Du darfst 2 Aktionskarten mehr halten und gibst bei Abstimmungen 1 Stimme zusätzlich ab.',
      en: 'You may hold 2 more action cards and cast 1 additional vote.',
    },
  ),
  'lorekeeper-frames': text(
    { de: 'Hüterrahmen', en: 'Lorekeeper Frames' },
    {
      de: 'Mech: Deine Mechs treffen bei einem um 1 niedrigeren Wurf.',
      en: 'Mech: Your mechs hit on a roll 1 lower.',
    },
  ),
  'blockade-runners': text(
    { de: 'Blockadebrecher', en: 'Blockade Runners' },
    {
      de: 'Deine Kreuzer haben Bewegung +1 und treffen bei einem um 1 niedrigeren Wurf.',
      en: 'Your cruisers have +1 move and hit on a roll 1 lower.',
    },
  ),
  'free-harbours': text(
    { de: 'Freihäfen', en: 'Free Harbours' },
    {
      de: 'Die Sekundärfähigkeit des Handels kostet dich keinen Strategiemarker. In jeder Statusphase erhältst du 1 Handelsware.',
      en: 'The secondary ability of Trade costs you no strategy token. In every status phase you gain 1 trade good.',
    },
  ),
  'forge-walkers': text(
    { de: 'Schmiedeläufer', en: 'Forge Walkers' },
    {
      de: 'Mech: Deine Mechs haben Produktion 1. Im System eines Mechs darfst du also auch ohne Raumdock 1 Einheit produzieren.',
      en: 'Mech: Your mechs have production 1, so you may produce 1 unit in a system with your mech even without a space dock.',
    },
  ),
};

export const factionAbilityText = (id: string): FactionAbilityText | undefined =>
  FACTION_ABILITY_TEXTS[id.startsWith('ti4:') ? (id.split(':').at(-1) ?? id) : id];
