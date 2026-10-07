import type { Brand } from '../shared/ids.ts';
import type { PlayerId } from '../shared/ids.ts';

export type StrategyCardId = Brand<string, 'StrategyCardId'>;
export const strategyCardId = (value: string): StrategyCardId => value as StrategyCardId;

/**
 * Welche Mechanik eine Karte auslöst. Die konkreten Effekte sind Strategy-Objekte
 * (Open/Closed): neue Mechaniken werden registriert, nicht in die Engine geschrieben.
 */
export type StrategyMechanic =
  | 'commandTokens'
  | 'diplomacy'
  | 'politics'
  | 'construction'
  | 'trade'
  | 'warfare'
  | 'technology'
  | 'imperial';

/** Stammdaten einer Strategiekarte (Content). */
export interface StrategyCardDefinition {
  readonly id: StrategyCardId;
  readonly initiative: number;
  readonly mechanic: StrategyMechanic;
  /** RR 46.5: Sekundärfähigkeit kostet normalerweise 1 Strategiemarker. */
  readonly secondaryCostsStrategyToken: boolean;
  /** Zahlenwerte der Mechanik, z. B. erhaltene Marker. */
  readonly parameters: Readonly<Record<string, number>>;
}

/** Zustand einer Strategiekarte in der Partie. */
export interface StrategyCardState {
  readonly id: StrategyCardId;
  readonly initiative: number;
  readonly mechanic: StrategyMechanic;
  readonly holder: PlayerId | null;
  readonly exhausted: boolean;
  /** RR 76.3: Handelswaren auf nicht gewählten Karten. */
  readonly tradeGoods: number;
}
