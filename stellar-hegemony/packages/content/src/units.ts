import { technologyId, unitTypeId, type UnitDefinition, type UnitTypeId } from '@stellar/domain';
import type { LocalizedText } from './localized.ts';

export const UNIT_TYPES = {
  carrier: unitTypeId('carrier'),
  cruiser: unitTypeId('cruiser'),
  destroyer: unitTypeId('destroyer'),
  dreadnought: unitTypeId('dreadnought'),
  fighter: unitTypeId('fighter'),
  sunbreaker: unitTypeId('sunbreaker'),
  infantry: unitTypeId('infantry'),
  orbitalBattery: unitTypeId('orbitalBattery'),
  orbitalDock: unitTypeId('orbitalDock'),
} as const;

const single = (resources: number) => ({ resources, unitsPerCost: 1 });
const pair = { resources: 1, unitsPerCost: 2 };

/** Grundwerte der Einheiten. Verbesserungen kommen über Technologien (Iteration 7). */
export const BASE_UNITS: readonly UnitDefinition[] = [
  {
    id: UNIT_TYPES.carrier,
    category: 'ship',
    isFighter: false,
    cost: single(3),
    combat: { hitOn: 9, dice: 1 },
    move: 1,
    capacity: 4,
    capabilities: [],
    componentLimit: 4,
  },
  {
    id: UNIT_TYPES.cruiser,
    category: 'ship',
    isFighter: false,
    cost: single(2),
    combat: { hitOn: 7, dice: 1 },
    move: 2,
    capabilities: [],
    componentLimit: 8,
  },
  {
    id: UNIT_TYPES.destroyer,
    category: 'ship',
    isFighter: false,
    cost: single(1),
    combat: { hitOn: 9, dice: 1 },
    move: 2,
    capabilities: [{ kind: 'antiFighterBarrage', profile: { hitOn: 9, dice: 2 } }],
    componentLimit: 8,
  },
  {
    id: UNIT_TYPES.dreadnought,
    category: 'ship',
    isFighter: false,
    cost: single(4),
    combat: { hitOn: 5, dice: 1 },
    move: 1,
    capacity: 1,
    capabilities: [
      { kind: 'sustainDamage' },
      { kind: 'bombardment', profile: { hitOn: 5, dice: 1 } },
    ],
    componentLimit: 5,
  },
  {
    id: UNIT_TYPES.fighter,
    category: 'ship',
    isFighter: true,
    cost: pair,
    combat: { hitOn: 9, dice: 1 },
    capabilities: [],
    componentLimit: 'unlimited',
  },
  {
    id: UNIT_TYPES.sunbreaker,
    category: 'ship',
    isFighter: false,
    cost: single(12),
    combat: { hitOn: 3, dice: 3 },
    move: 2,
    capacity: 6,
    capabilities: [
      { kind: 'sustainDamage' },
      { kind: 'bombardment', profile: { hitOn: 3, dice: 3 } },
      { kind: 'ignoresPlanetaryShield' },
    ],
    componentLimit: 2,
    requiresTechnology: technologyId('sunbreaker-blueprint'),
  },
  {
    id: UNIT_TYPES.infantry,
    category: 'groundForce',
    isFighter: false,
    cost: pair,
    combat: { hitOn: 8, dice: 1 },
    capabilities: [],
    componentLimit: 'unlimited',
  },
  {
    id: UNIT_TYPES.orbitalBattery,
    category: 'structure',
    isFighter: false,
    capabilities: [
      { kind: 'spaceCannon', profile: { hitOn: 6, dice: 1 }, range: 0 },
      { kind: 'planetaryShield' },
    ],
    componentLimit: 6,
  },
  {
    id: UNIT_TYPES.orbitalDock,
    category: 'structure',
    isFighter: false,
    capabilities: [
      { kind: 'production', bonus: 2, addsPlanetResources: true },
      { kind: 'fighterHangar', fighters: 3 },
    ],
    componentLimit: 3,
  },
];

export const UNIT_NAMES: Readonly<Record<string, LocalizedText>> = {
  [UNIT_TYPES.carrier]: { de: 'Träger', en: 'Carrier' },
  [UNIT_TYPES.cruiser]: { de: 'Kreuzer', en: 'Cruiser' },
  [UNIT_TYPES.destroyer]: { de: 'Zerstörer', en: 'Destroyer' },
  [UNIT_TYPES.dreadnought]: { de: 'Schlachtschiff', en: 'Dreadnought' },
  [UNIT_TYPES.fighter]: { de: 'Jäger', en: 'Fighter' },
  [UNIT_TYPES.sunbreaker]: { de: 'Sonnenbrecher', en: 'Sunbreaker' },
  [UNIT_TYPES.infantry]: { de: 'Infanterie', en: 'Infantry' },
  [UNIT_TYPES.orbitalBattery]: { de: 'PVS', en: 'PDS' },
  [UNIT_TYPES.orbitalDock]: { de: 'Raumdock', en: 'Space Dock' },
};

export const unitName = (type: UnitTypeId): LocalizedText | undefined => UNIT_NAMES[type];
