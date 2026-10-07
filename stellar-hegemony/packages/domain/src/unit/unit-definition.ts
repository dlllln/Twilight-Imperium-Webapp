import type { TechnologyId, UnitTypeId } from '../shared/ids.ts';

export type UnitCategory = 'ship' | 'groundForce' | 'structure';

/** Treffer bei Wurf ≥ `hitOn`; `dice` Würfel pro Einheit. */
export interface CombatProfile {
  readonly hitOn: number;
  readonly dice: number;
}

export interface ProductionCost {
  readonly resources: number;
  /** Wie viele Einheiten man für diese Kosten erhält (Jäger, Infanterie: 2). */
  readonly unitsPerCost: number;
}

/**
 * Sonderfähigkeiten als Daten (Liskov + Polymorphie): Engine-Code fragt
 * Fähigkeiten ab, niemals den konkreten Einheitentyp.
 */
export type UnitCapability =
  | { readonly kind: 'sustainDamage' }
  | { readonly kind: 'bombardment'; readonly profile: CombatProfile }
  | { readonly kind: 'spaceCannon'; readonly profile: CombatProfile; readonly range: number }
  | { readonly kind: 'antiFighterBarrage'; readonly profile: CombatProfile }
  | { readonly kind: 'production'; readonly bonus: number; readonly addsPlanetResources: boolean }
  | { readonly kind: 'planetaryShield' }
  | { readonly kind: 'ignoresPlanetaryShield' }
  | { readonly kind: 'fighterHangar'; readonly fighters: number };

export type CapabilityKind = UnitCapability['kind'];

export type CapabilityOf<K extends CapabilityKind> = Extract<UnitCapability, { kind: K }>;

export type ComponentLimit = number | 'unlimited';

export interface UnitDefinition {
  readonly id: UnitTypeId;
  readonly category: UnitCategory;
  /** Jäger sind Schiffe, belegen aber Kapazität und zählen nicht zum Flottenlimit. */
  readonly isFighter: boolean;
  readonly cost?: ProductionCost;
  readonly combat?: CombatProfile;
  readonly move?: number;
  readonly capacity?: number;
  readonly capabilities: readonly UnitCapability[];
  readonly componentLimit: ComponentLimit;
  /** Nur produzierbar, wenn der Spieler diese Technologie besitzt. */
  readonly requiresTechnology?: TechnologyId;
}
