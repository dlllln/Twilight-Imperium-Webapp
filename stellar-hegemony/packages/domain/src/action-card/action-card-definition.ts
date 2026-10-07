import type { ActionCardId, UnitTypeId } from '../shared/ids.ts';

/**
 * Zeitpunkt, zu dem eine Aktionskarte gespielt werden darf (RR 3.6: der erste Absatz der Karte).
 * `action` ist eine Materialaktion im eigenen Zug (RR 51); die übrigen sind Reaktionen.
 */
export type ActionTiming =
  'action' | 'afterActivation' | 'combatRound' | 'afterHits' | 'invasion' | 'secondary' | 'cancel';

/** Zeitfenster, die die Domain öffnet und reihum abfragt (RR 3.10). */
export type WindowKind = Extract<ActionTiming, 'afterActivation' | 'combatRound' | 'invasion'>;

/** Wer bei einem Einmarsch eine Bodenkampf-Karte spielen darf. */
export type InvasionRole = 'attacker' | 'defender';

/**
 * Wirkung einer Aktionskarte als Daten (Interpreter wie bei den Aufträgen). Jede Art hat
 * genau eine Prüf- und Abhandlungsfunktion in `card-effects.ts`.
 */
export type ActionEffect =
  | { readonly kind: 'gainTradeGoods'; readonly amount: number }
  | { readonly kind: 'replenishCommodities' }
  | { readonly kind: 'readyPlanets'; readonly count: number }
  | { readonly kind: 'gainCommandTokens'; readonly amount: number }
  | { readonly kind: 'recallToken' }
  | {
      readonly kind: 'placeUnits';
      readonly unit: UnitTypeId;
      readonly count: number;
      readonly where: 'homePlanet' | 'activatedPlanet';
    }
  | { readonly kind: 'drawActionCards'; readonly count: number }
  | { readonly kind: 'exhaustForeignPlanet' }
  | { readonly kind: 'stealTradeGoods'; readonly amount: number }
  | { readonly kind: 'destroyGroundForce'; readonly count: number }
  | { readonly kind: 'repairUnits' }
  | { readonly kind: 'tradeGoodsPerNeighbor'; readonly amount: number }
  | { readonly kind: 'combatBonus'; readonly amount: number }
  | { readonly kind: 'cancelHits'; readonly amount: number }
  | { readonly kind: 'groundBonus'; readonly amount: number; readonly role: InvasionRole }
  | { readonly kind: 'freeSecondary' }
  | { readonly kind: 'cancelCard' };

export type EffectKind = ActionEffect['kind'];

/** Stammdaten einer Aktionskarte; `copies` Exemplare liegen im Stapel. */
export interface ActionCardDefinition {
  readonly id: ActionCardId;
  readonly copies: number;
  readonly timing: ActionTiming;
  readonly effect: ActionEffect;
}
