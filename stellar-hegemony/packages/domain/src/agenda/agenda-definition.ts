import type { CommandPool } from '../player/command-sheet.ts';
import type { PlanetTrait } from '../planet/planet-definition.ts';
import type { AgendaId, UnitTypeId } from '../shared/ids.ts';

/** RR 1.1: Gesetze wirken dauerhaft, Direktiven einmal. */
export type AgendaKind = 'law' | 'directive';

/** Worüber abgestimmt wird (RR 2.8/2.9): Dafür/Dagegen, ein Spieler oder ein Planet. */
export type Election =
  | { readonly kind: 'forAgainst' }
  | { readonly kind: 'player' }
  | { readonly kind: 'planet'; readonly filter: PlanetFilter };

/** Welche kontrollierten Planeten wählbar sind (RR 2.12: nur Planeten mit Besitzer). */
export type PlanetFilter =
  | { readonly kind: 'any' }
  | { readonly kind: 'nonHome' }
  | { readonly kind: 'trait'; readonly trait: PlanetTrait };

/**
 * Wer eine Wirkung erhält: alle, wer für bzw. gegen das Ergebnis stimmte, der Gewählte
 * (bei Planeten dessen Besitzer) oder einmal der Sprecher für Wirkungen ohne Empfänger.
 */
export type Recipients = 'all' | 'supporters' | 'opponents' | 'elected' | 'speaker';

/** Einmalige Wirkungen (Direktiven und die Dagegen-Seite von Gesetzen). */
export type AgendaEffect =
  | { readonly kind: 'gainTradeGoods'; readonly amount: number }
  | { readonly kind: 'loseTradeGoods'; readonly amount: number }
  | { readonly kind: 'replenishCommodities' }
  | { readonly kind: 'gainCommandTokens'; readonly pool: CommandPool; readonly amount: number }
  | { readonly kind: 'loseCommandTokens'; readonly pool: CommandPool; readonly amount: number }
  | { readonly kind: 'drawActionCards'; readonly count: number }
  /** Zufällig abwerfen; `count: null` heißt alle Karten. */
  | { readonly kind: 'discardActionCards'; readonly count: number | null }
  | { readonly kind: 'drawSecretObjective' }
  | { readonly kind: 'gainVictoryPoints'; readonly amount: number }
  | { readonly kind: 'exhaustPlanets'; readonly trait: PlanetTrait }
  | { readonly kind: 'repairUnits' }
  | {
      readonly kind: 'placeUnits';
      readonly unit: UnitTypeId;
      readonly count: number;
      readonly where: 'electedPlanet' | 'homeSystem';
    }
  | { readonly kind: 'destroyStructures' }
  | { readonly kind: 'repealLaws' };

export type AgendaEffectKind = AgendaEffect['kind'];

export interface AgendaStep {
  readonly recipients: Recipients;
  readonly effect: AgendaEffect;
}

/** Regelwerte, die ein Gesetz verschieben darf (Protected Variations: nur diese). */
export type AdjustableRule =
  | 'actionCardHandLimit'
  | 'statusPhaseActionCards'
  | 'statusPhaseCommandTokens'
  | 'maxSecretObjectives'
  | 'nebulaMoveValue';

/** Dauerhafte Wirkung eines beschlossenen Gesetzes (RR 1.3). */
export type LawEffect =
  | { readonly kind: 'ruleChange'; readonly rule: AdjustableRule; readonly delta: number }
  | { readonly kind: 'commodityLimitAll'; readonly delta: number }
  | { readonly kind: 'ownerVotes'; readonly amount: number }
  | { readonly kind: 'ownerVictoryPoints'; readonly amount: number }
  | { readonly kind: 'ownerCommodityLimit'; readonly amount: number };

/** Ergebnis bei Dafür bzw. bei einer Wahl; ein Gesetz bleibt dann im Spiel. */
export interface PassedOutcome {
  readonly steps: readonly AgendaStep[];
  readonly law?: LawEffect;
}

export interface AgendaDefinition {
  readonly id: AgendaId;
  readonly kind: AgendaKind;
  readonly election: Election;
  readonly passed: PassedOutcome;
  /** Nur bei Dafür/Dagegen: was bei „Dagegen“ geschieht (RR 1.6). */
  readonly rejected: readonly AgendaStep[];
}

export const FOR = 'for';
export const AGAINST = 'against';
