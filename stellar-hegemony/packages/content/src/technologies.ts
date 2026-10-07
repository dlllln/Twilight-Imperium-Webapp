import {
  type TechnologyColor,
  type TechnologyDefinition,
  technologyId,
  type UnitModifier,
} from '@stellar/domain';
import type { LocalizedText } from './localized.ts';
import { UNIT_TYPES } from './units.ts';

/*
 * Eigener Technologiebaum: je Farbe vier Stufen (0 bis 3 Voraussetzungen derselben
 * Farbe) und eine Aufwertung je Einheit. Namen, Werte und Texte sind eigene.
 */
const U = UNIT_TYPES;

const SHIPS = { category: 'ship', fighters: false } as const;

const tech = (
  id: string,
  color: TechnologyColor | null,
  prerequisites: readonly TechnologyColor[],
  modifiers: readonly UnitModifier[],
  extra: Partial<Pick<TechnologyDefinition, 'upgrades' | 'rules'>> = {},
): TechnologyDefinition => ({ id: technologyId(id), color, prerequisites, modifiers, ...extra });

const repeat = (color: TechnologyColor, times: number): readonly TechnologyColor[] =>
  Array.from({ length: times }, () => color);

const COLORED: readonly TechnologyDefinition[] = [
  tech(
    'cell-regeneration',
    'biotic',
    [],
    [{ target: { types: [U.infantry] }, change: { hitOn: -1 } }],
  ),
  tech('brood-chambers', 'biotic', repeat('biotic', 1), [
    {
      target: { types: [U.infantry] },
      change: { set: { cost: { resources: 1, unitsPerCost: 3 } } },
    },
  ]),
  tech('symbiotic-armour', 'biotic', repeat('biotic', 2), [
    { target: { types: [U.infantry] }, change: { add: [{ kind: 'sustainDamage' }] } },
  ]),
  tech('living-shipyards', 'biotic', repeat('biotic', 3), [
    {
      target: { types: [U.orbitalDock] },
      change: { capability: { kind: 'production', bonus: 2 } },
    },
  ]),
  tech(
    'ion-drive',
    'propulsion',
    [],
    [{ target: { types: [U.destroyer, U.cruiser] }, change: { move: 1 } }],
  ),
  tech('expanded-holds', 'propulsion', repeat('propulsion', 1), [
    { target: { types: [U.carrier] }, change: { capacity: 1 } },
  ]),
  tech('fold-drive', 'propulsion', repeat('propulsion', 2), [
    { target: SHIPS, change: { move: 1 } },
  ]),
  tech('fleet-coordination', 'propulsion', repeat('propulsion', 3), [], {
    rules: { fleetLimit: 2 },
  }),
  tech(
    'target-acquisition',
    'cybernetic',
    [],
    [
      {
        target: { category: 'ship' },
        change: { capability: { kind: 'antiFighterBarrage', hitOn: -1 } },
      },
    ],
  ),
  tech('orbital-sensors', 'cybernetic', repeat('cybernetic', 1), [
    {
      target: { category: 'structure' },
      change: { capability: { kind: 'spaceCannon', range: 1 } },
    },
  ]),
  tech('hangar-automation', 'cybernetic', repeat('cybernetic', 2), [
    {
      target: { types: [U.orbitalDock] },
      change: { capability: { kind: 'fighterHangar', fighters: 2 } },
    },
  ]),
  tech('battle-computers', 'cybernetic', repeat('cybernetic', 3), [
    { target: { category: 'ship' }, change: { hitOn: -1 } },
  ]),
  tech(
    'reactive-plating',
    'warfare',
    [],
    [{ target: { types: [U.cruiser] }, change: { add: [{ kind: 'sustainDamage' }] } }],
  ),
  tech('bunker-works', 'warfare', repeat('warfare', 1), [
    {
      target: { category: 'structure' },
      change: { capability: { kind: 'spaceCannon', hitOn: -1 } },
    },
  ]),
  tech('penetrator-shells', 'warfare', repeat('warfare', 2), [
    { target: { category: 'ship' }, change: { capability: { kind: 'bombardment', dice: 1 } } },
    { target: { types: [U.dreadnought] }, change: { add: [{ kind: 'ignoresPlanetaryShield' }] } },
  ]),
  tech('assault-doctrine', 'warfare', repeat('warfare', 3), [
    { target: { types: [U.dreadnought, U.cruiser] }, change: { dice: 1 } },
  ]),
];

const upgrade = (
  id: string,
  unit: (typeof U)[keyof typeof U],
  prerequisites: readonly TechnologyColor[],
  change: UnitModifier['change'],
) => tech(id, null, prerequisites, [{ target: { types: [unit] }, change }], { upgrades: unit });

const UPGRADES: readonly TechnologyDefinition[] = [
  upgrade('heavy-carrier', U.carrier, ['propulsion', 'propulsion'], {
    set: { move: 2, capacity: 6 },
  }),
  upgrade('strike-cruiser', U.cruiser, ['biotic', 'cybernetic', 'warfare'], {
    set: { move: 3, capacity: 1, combat: { hitOn: 6, dice: 1 } },
  }),
  upgrade('interceptor-destroyer', U.destroyer, ['warfare', 'warfare'], {
    set: {
      combat: { hitOn: 8, dice: 1 },
      capabilities: [{ kind: 'antiFighterBarrage', profile: { hitOn: 6, dice: 3 } }],
    },
  }),
  upgrade('bastion-battleship', U.dreadnought, ['propulsion', 'propulsion', 'cybernetic'], {
    set: { move: 2 },
  }),
  upgrade('swarm-fighter', U.fighter, ['biotic', 'propulsion'], {
    set: { combat: { hitOn: 8, dice: 1 } },
  }),
  upgrade('veteran-infantry', U.infantry, ['biotic', 'biotic'], {
    set: { combat: { hitOn: 7, dice: 1 } },
  }),
  upgrade('fortress-battery', U.orbitalBattery, ['cybernetic', 'warfare'], {
    set: {
      capabilities: [
        { kind: 'spaceCannon', profile: { hitOn: 5, dice: 1 }, range: 1 },
        { kind: 'planetaryShield' },
      ],
    },
  }),
  upgrade('grand-dock', U.orbitalDock, ['cybernetic', 'cybernetic'], {
    set: {
      capabilities: [
        { kind: 'production', bonus: 4, addsPlanetResources: true },
        { kind: 'fighterHangar', fighters: 5 },
      ],
    },
  }),
  tech('sunbreaker-blueprint', null, ['warfare', 'warfare', 'warfare', 'cybernetic'], [], {
    upgrades: U.sunbreaker,
  }),
];

export const TECHNOLOGIES: readonly TechnologyDefinition[] = [...COLORED, ...UPGRADES];

export interface TechnologyText {
  readonly name: LocalizedText;
  readonly effect: LocalizedText;
}

const text = (de: string, en: string, effectDe: string, effectEn: string): TechnologyText => ({
  name: { de, en },
  effect: { de: effectDe, en: effectEn },
});

export const TECHNOLOGY_TEXTS: Readonly<Record<string, TechnologyText>> = {
  'cell-regeneration': text(
    'Zellregeneration',
    'Cell Regeneration',
    'Infanterie trifft um 1 leichter.',
    'Infantry hit 1 more easily.',
  ),
  'brood-chambers': text(
    'Brutkammern',
    'Brood Chambers',
    'Für 1 Ressource entstehen 3 Infanterie.',
    '1 resource produces 3 infantry.',
  ),
  'symbiotic-armour': text(
    'Symbiotische Panzerung',
    'Symbiotic Armour',
    'Infanterie kann Schaden abfangen.',
    'Infantry can sustain damage.',
  ),
  'living-shipyards': text(
    'Lebende Werften',
    'Living Shipyards',
    'Raumdocks produzieren 2 Einheiten mehr.',
    'Orbital docks produce 2 more units.',
  ),
  'ion-drive': text(
    'Ionenantrieb',
    'Ion Drive',
    'Zerstörer und Kreuzer bewegen sich 1 weiter.',
    'Destroyers and cruisers move 1 further.',
  ),
  'expanded-holds': text(
    'Erweiterte Laderäume',
    'Expanded Holds',
    'Träger haben 1 Platz mehr.',
    'Carriers have 1 more capacity.',
  ),
  'fold-drive': text(
    'Faltraumtriebwerk',
    'Fold Drive',
    'Alle Schiffe außer Jägern bewegen sich 1 weiter.',
    'All non-fighter ships move 1 further.',
  ),
  'fleet-coordination': text(
    'Flottenkoordination',
    'Fleet Coordination',
    'Dein Flottenlimit steigt um 2.',
    'Your fleet limit rises by 2.',
  ),
  'target-acquisition': text(
    'Zielerfassung',
    'Target Acquisition',
    'Jägerabwehr trifft um 1 leichter.',
    'Anti-fighter barrage hits 1 more easily.',
  ),
  'orbital-sensors': text(
    'Orbitalsensoren',
    'Orbital Sensors',
    'Weltraumkanonen auf Planeten reichen 1 System weiter.',
    'Planet-based space cannons reach 1 system further.',
  ),
  'hangar-automation': text(
    'Hangar-Automatik',
    'Hangar Automation',
    'Raumdocks versorgen 2 Jäger mehr.',
    'Orbital docks support 2 more fighters.',
  ),
  'battle-computers': text(
    'Gefechtsrechner',
    'Battle Computers',
    'Alle Schiffe treffen um 1 leichter.',
    'All ships hit 1 more easily.',
  ),
  'reactive-plating': text(
    'Reaktivpanzerung',
    'Reactive Plating',
    'Kreuzer können Schaden abfangen.',
    'Cruisers can sustain damage.',
  ),
  'bunker-works': text(
    'Bunkerbau',
    'Bunker Works',
    'Weltraumkanonen auf Planeten treffen um 1 leichter.',
    'Planet-based space cannons hit 1 more easily.',
  ),
  'penetrator-shells': text(
    'Durchschlagsgeschosse',
    'Penetrator Shells',
    'Bombardement mit 1 Würfel mehr; Schlachtschiffe durchdringen Planetare Schilde.',
    'Bombardment rolls 1 more die; battleships pierce planetary shields.',
  ),
  'assault-doctrine': text(
    'Sturmdoktrin',
    'Assault Doctrine',
    'Schlachtschiffe und Kreuzer werfen im Kampf 1 Würfel mehr.',
    'Battleships and cruisers roll 1 more combat die.',
  ),
  'heavy-carrier': text(
    'Schwerlast-Träger',
    'Heavy Carrier',
    'Träger: Bewegung 2, Kapazität 6.',
    'Carrier: move 2, capacity 6.',
  ),
  'strike-cruiser': text(
    'Sturmkreuzer',
    'Strike Cruiser',
    'Kreuzer: Bewegung 3, Kapazität 1, Kampf 6.',
    'Cruiser: move 3, capacity 1, combat 6.',
  ),
  'interceptor-destroyer': text(
    'Abfangzerstörer',
    'Interceptor Destroyer',
    'Zerstörer: Kampf 8, Jägerabwehr 6 mit 3 Würfeln.',
    'Destroyer: combat 8, anti-fighter barrage 6 with 3 dice.',
  ),
  'bastion-battleship': text(
    'Bastion-Schlachtschiff',
    'Bastion Battleship',
    'Schlachtschiff: Bewegung 2.',
    'Battleship: move 2.',
  ),
  'swarm-fighter': text('Schwarmjäger', 'Swarm Fighter', 'Jäger: Kampf 8.', 'Fighter: combat 8.'),
  'veteran-infantry': text(
    'Veteranen-Infanterie',
    'Veteran Infantry',
    'Infanterie: Kampf 7.',
    'Infantry: combat 7.',
  ),
  'fortress-battery': text(
    'Festungsgeschütz',
    'Fortress Battery',
    'Orbitalgeschütz: Weltraumkanone 5 mit Reichweite 1.',
    'Orbital battery: space cannon 5 with range 1.',
  ),
  'grand-dock': text(
    'Großwerft',
    'Grand Dock',
    'Raumdock: Produktion +4, versorgt 5 Jäger.',
    'Orbital dock: production +4, supports 5 fighters.',
  ),
  'sunbreaker-blueprint': text(
    'Sonnenbrecher-Baupläne',
    'Sunbreaker Blueprint',
    'Du darfst Sonnenbrecher bauen.',
    'You may build sunbreakers.',
  ),
};

export const technologyText = (id: string): TechnologyText | undefined => TECHNOLOGY_TEXTS[id];
