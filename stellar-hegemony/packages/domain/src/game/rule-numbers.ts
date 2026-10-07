import type { PoolCounts } from '../player/command-sheet.ts';

/**
 * Alle Zahlenwerte des Regelwerks an einer Stelle (Protected Variations).
 * Die Domain enthält keine Magic Numbers; die Werte liefert das Content-Paket.
 */
export interface RuleNumbers {
  readonly dieSides: number;
  readonly minPlayers: number;
  readonly maxPlayers: number;
  readonly victoryPointOptions: readonly number[];
  readonly commandTokensPerPlayer: number;
  readonly startingCommandPools: PoolCounts;
  readonly statusPhaseCommandTokens: number;
  readonly strategyCardCount: number;
  readonly strategyCardAllotment: {
    /** Bei höchstens so vielen Spielern gilt `cardsWhenFewPlayers`. */
    readonly fewPlayersThreshold: number;
    readonly cardsWhenFewPlayers: number;
    readonly cardsOtherwise: number;
  };
  readonly publicObjectivesPerStage: number;
  readonly initiallyRevealedObjectives: number;
  readonly secretObjectivesDealt: number;
  readonly secretObjectivesKept: number;
  readonly maxSecretObjectives: number;
  readonly centerTokenInfluenceCost: number;
  readonly centerTokenVictoryPoints: number;
  readonly agendasPerPhase: number;
  readonly actionCardHandLimit: number;
  /** RR 57.2: Bewegungswert von Schiffen, die im Nebel starten. */
  readonly nebulaMoveValue: number;
  /** RR 33.1: Bonus je verlassenem Gravitationsstrudel. */
  readonly gravityRiftMoveBonus: number;
  /** Wurf bis einschließlich dieses Werts zerstört ein Schiff, das einen Strudel verlässt. */
  readonly gravityRiftDestroyMaxRoll: number;
  /** Gebäude je Planet: höchstens so viele mit Produktion bzw. mit Weltraumkanone. */
  readonly maxProductionStructuresPerPlanet: number;
  readonly maxCannonStructuresPerPlanet: number;
}
