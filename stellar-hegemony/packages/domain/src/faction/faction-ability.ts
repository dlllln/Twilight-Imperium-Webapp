import { findPlayer, type GameState } from '../game/game-state.ts';
import type { PlayerId } from '../shared/ids.ts';
import type { StrategyMechanic } from '../strategy/strategy-card.ts';
import type { UnitModifier } from '../technology/technology-definition.ts';

/**
 * Zahlenwerte, um die eine Fraktion von den allgemeinen Regeln abweicht. Sie werden beim
 * Spielstart in den Spielerzustand übernommen, damit Regeln sie ohne Content lesen können.
 */
export interface FactionRules {
  /** Zusätzliches Flottenlimit (RR 28). */
  readonly fleetLimit: number;
  /** Zusätzliche Stimmen bei jeder Abstimmung, sobald man für ein Ergebnis stimmt. */
  readonly extraVotes: number;
  /** Handelswaren zu Beginn jeder Statusphase. */
  readonly statusTradeGoods: number;
  /** Zusätzliche Aktionskarten in der Statusphase. */
  readonly statusActionCards: number;
  /** Zusätzliche Kommandomarker in der Statusphase. */
  readonly statusCommandTokens: number;
  /** Abweichung vom Handkartenlimit für Aktionskarten. */
  readonly actionCardHandLimit: number;
  /** Sekundärfähigkeiten dieser Strategiekarten kosten keinen Strategiemarker. */
  readonly freeSecondaries: readonly StrategyMechanic[];
}

export const NO_FACTION_RULES: FactionRules = {
  fleetLimit: 0,
  extraVotes: 0,
  statusTradeGoods: 0,
  statusActionCards: 0,
  statusCommandTokens: 0,
  actionCardHandLimit: 0,
  freeSecondaries: [],
};

/** Eine Fraktionsfähigkeit als Daten: Einheitenwerte wie bei Technologien und Regelwerte. */
export interface FactionAbility {
  readonly id: string;
  readonly modifiers: readonly UnitModifier[];
  readonly rules: Partial<FactionRules>;
}

type NumericRule = Exclude<keyof FactionRules, 'freeSecondaries'>;

const NUMERIC: readonly NumericRule[] = [
  'fleetLimit',
  'extraVotes',
  'statusTradeGoods',
  'statusActionCards',
  'statusCommandTokens',
  'actionCardHandLimit',
];

/** Summe aller Fähigkeiten einer Fraktion (Composite). */
export function combinedRules(abilities: readonly FactionAbility[]): FactionRules {
  const numbers = Object.fromEntries(
    NUMERIC.map((rule) => [
      rule,
      abilities.reduce((sum, ability) => sum + (ability.rules[rule] ?? 0), 0),
    ]),
  ) as Record<NumericRule, number>;
  const freeSecondaries = abilities.flatMap((ability) => ability.rules.freeSecondaries ?? []);
  return { ...numbers, freeSecondaries };
}

/** Regelwert der Fraktion eines Spielers; unbekannte Spieler weichen nicht ab. */
export const factionRule = (state: GameState, player: PlayerId, rule: NumericRule): number =>
  findPlayer(state, player)?.factionRules[rule] ?? 0;

export const freeSecondary = (
  state: GameState,
  player: PlayerId,
  mechanic: StrategyMechanic,
): boolean => findPlayer(state, player)?.factionRules.freeSecondaries.includes(mechanic) === true;
