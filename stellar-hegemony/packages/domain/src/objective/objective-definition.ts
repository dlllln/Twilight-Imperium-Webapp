import type { Currency } from '../economy/payment.ts';
import type { PlanetTrait, TechnologyColor } from '../planet/planet-definition.ts';
import type { ObjectiveId, UnitTypeId } from '../shared/ids.ts';
import type { CapabilityKind } from '../unit/unit-definition.ts';

/** Kennzahlen, die während einer Runde mitgezählt werden (für Aufträge der Aktionsphase). */
export type RoundStat = 'spaceCombatsWon' | 'groundCombatsWon' | 'shipsDestroyed' | 'planetsGained';

/** Wo eigene Schiffe stehen müssen. */
export type SystemFilter = 'anyNonHome' | 'anomaly' | 'adjacentToCenter' | 'center' | 'foreignHome';

/**
 * Anforderung eines Auftrags als Daten (Interpreter): Jede Art hat genau einen Prüfer.
 * Neue Aufträge brauchen so keinen neuen Code, solange sie bekannte Arten nutzen (OCP).
 */
export type ObjectiveCondition =
  | {
      readonly kind: 'planets';
      readonly count: number;
      readonly trait?: PlanetTrait;
      readonly exceptHome?: boolean;
    }
  | { readonly kind: 'planetsOfEachTrait'; readonly count: number }
  | { readonly kind: 'specialtyPlanets'; readonly count: number; readonly distinct?: boolean }
  | { readonly kind: 'spend'; readonly currency: Currency | 'tradeGoods'; readonly amount: number }
  | { readonly kind: 'tradeGoods'; readonly count: number }
  | { readonly kind: 'technologiesInColors'; readonly colors: number; readonly perColor: number }
  | {
      readonly kind: 'technologiesOfColor';
      readonly color?: TechnologyColor;
      readonly count: number;
    }
  | { readonly kind: 'unitUpgrades'; readonly count: number }
  | { readonly kind: 'structuredPlanets'; readonly count: number }
  | { readonly kind: 'structures'; readonly capability: CapabilityKind; readonly count: number }
  | { readonly kind: 'systemsWithShips'; readonly where: SystemFilter; readonly count: number }
  | { readonly kind: 'shipsInOneSystem'; readonly count: number }
  | { readonly kind: 'units'; readonly type: UnitTypeId; readonly count: number }
  | { readonly kind: 'centerPlanet' }
  | { readonly kind: 'foreignHomePlanet' }
  | { readonly kind: 'fleetPool'; readonly count: number }
  | { readonly kind: 'systemsWithTokens'; readonly count: number }
  | { readonly kind: 'roundStat'; readonly stat: RoundStat; readonly count: number };

export type ObjectiveCategory = 'public' | 'secret';

/** RR 12.3: Ein Auftrag wird in der Status- oder in der Aktionsphase gewertet. */
export type ObjectiveTiming = 'status' | 'action';

/** Stammdaten eines Auftrags (RR 12). `stage` gibt es nur bei öffentlichen Aufträgen. */
export interface ObjectiveDefinition {
  readonly id: ObjectiveId;
  readonly category: ObjectiveCategory;
  readonly stage: number | null;
  readonly points: number;
  readonly timing: ObjectiveTiming;
  readonly condition: ObjectiveCondition;
}
