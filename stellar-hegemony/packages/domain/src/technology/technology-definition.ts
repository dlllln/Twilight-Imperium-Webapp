import type { TechnologyColor } from '../planet/planet-definition.ts';
import type { TechnologyId, UnitTypeId } from '../shared/ids.ts';
import type {
  CapabilityKind,
  UnitCapability,
  UnitCategory,
  UnitDefinition,
} from '../unit/unit-definition.ts';

/** Welche Einheiten eine Änderung betrifft; alle angegebenen Merkmale müssen passen. */
export interface UnitSelector {
  readonly types?: readonly UnitTypeId[];
  readonly category?: UnitCategory;
  readonly fighters?: boolean;
}

/** Änderung einer Fähigkeit: Werte werden addiert (negativer `hitOn` heißt „trifft leichter“). */
export interface CapabilityChange {
  readonly kind: CapabilityKind;
  readonly hitOn?: number;
  readonly dice?: number;
  readonly range?: number;
  readonly bonus?: number;
  readonly fighters?: number;
}

export type UnitStats = Pick<
  UnitDefinition,
  'cost' | 'combat' | 'move' | 'capacity' | 'capabilities'
>;

/**
 * Wirkung auf Einheitenwerte. `set` ersetzt Grundwerte (Aufwertungen), die übrigen Felder
 * werden danach addiert bzw. ergänzt. So bleiben Technologien reine Daten (Open/Closed).
 */
export interface UnitChange {
  readonly set?: Partial<UnitStats>;
  readonly move?: number;
  readonly hitOn?: number;
  readonly dice?: number;
  readonly capacity?: number;
  readonly add?: readonly UnitCapability[];
  readonly capability?: CapabilityChange;
}

export interface UnitModifier {
  readonly target: UnitSelector;
  readonly change: UnitChange;
}

/** Wirkungen außerhalb der Einheitenwerte. */
export interface RuleModifier {
  readonly fleetLimit?: number;
}

/**
 * Stammdaten einer Technologie (RR 80). `color` fehlt bei Aufwertungen für Einheiten;
 * sie erfüllen keine Voraussetzungen (RR 80.7). `prerequisites` ist eine Mehrfachmenge.
 */
export interface TechnologyDefinition {
  readonly id: TechnologyId;
  readonly color: TechnologyColor | null;
  readonly prerequisites: readonly TechnologyColor[];
  readonly upgrades?: UnitTypeId;
  readonly modifiers: readonly UnitModifier[];
  readonly rules?: RuleModifier;
}
