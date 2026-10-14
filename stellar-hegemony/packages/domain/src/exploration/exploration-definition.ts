import type { PlanetTrait, TechnologyColor } from '../planet/planet-definition.ts';
import type { ExplorationCardId, RelicId, UnitTypeId } from '../shared/ids.ts';
import type { UnitModifier } from '../technology/technology-definition.ts';

/** PoK Erkundung: je Planeteneigenschaft ein Stapel und ein Grenzstapel für leere Systeme. */
export type ExplorationDeckKind = PlanetTrait | 'frontier';

export const EXPLORATION_DECKS: readonly ExplorationDeckKind[] = [
  'cultural',
  'hazardous',
  'industrial',
  'frontier',
];

/** Art eines Reliktfragments; Grenzfragmente zählen als jede Art. */
export type FragmentKind = ExplorationDeckKind;

/**
 * Sofortige Wirkung als Daten (Interpreter in `reward-effects.ts`). Erkundungskarten,
 * Relikte und legendäre Planeten teilen sich diese Wirkungen; alles wirkt ohne Wahl.
 */
export type RewardEffect =
  | { readonly kind: 'gainTradeGoods'; readonly amount: number }
  /** Rohstoffe höchstens bis zum Rohstofflimit. */
  | { readonly kind: 'gainCommodities'; readonly amount: number }
  | { readonly kind: 'drawActionCards'; readonly count: number }
  /** Einheiten aus der Verstärkung auf den Planeten der Quelle, soweit der Vorrat reicht. */
  | { readonly kind: 'placeUnits'; readonly unit: UnitTypeId; readonly count: number }
  /** Alle eigenen erschöpften Planeten werden bereit. */
  | { readonly kind: 'readyPlanets' }
  | { readonly kind: 'repairUnits' }
  /** Kommandomarker aus dem Nachschub in den Taktikpool. */
  | { readonly kind: 'gainCommandTokens'; readonly amount: number }
  | { readonly kind: 'gainVictoryPoints'; readonly amount: number };

export type RewardKind = RewardEffect['kind'];

/** Wirkung einer Erkundungskarte: eine Belohnung oder eine der Erkundungs-Sonderformen. */
export type ExplorationEffect =
  | RewardEffect
  /** Bleibt auf dem Planeten liegen und ändert seine Werte dauerhaft. */
  | {
      readonly kind: 'attachment';
      readonly resources: number;
      readonly influence: number;
      readonly specialty?: TechnologyColor;
    }
  /** Der Spieler behält die Karte offen als Reliktfragment der Stapelart. */
  | { readonly kind: 'relicFragment' }
  /** Handelswaren liegen im System, bis sie jemand mit Schiffen abholt. */
  | { readonly kind: 'tradeGoodsCache'; readonly amount: number };

export interface ExplorationCardDefinition {
  readonly id: ExplorationCardId;
  readonly deck: ExplorationDeckKind;
  readonly copies: number;
  readonly effect: ExplorationEffect;
}

/** Was ein Relikt tut: beim Erhalt, dauerhaft oder als Komponentenaktion. */
export type RelicEffect =
  | { readonly kind: 'onGain'; readonly reward: RewardEffect }
  | {
      readonly kind: 'passive';
      readonly modifiers: readonly UnitModifier[];
      readonly fleetLimit: number;
    }
  | {
      readonly kind: 'action';
      readonly reward: RewardEffect;
      /** `exhaust`: einmal je Runde, `purge`: danach aus dem Spiel. */
      readonly usage: 'exhaust' | 'purge';
    };

export interface RelicDefinition {
  readonly id: RelicId;
  readonly effect: RelicEffect;
}
