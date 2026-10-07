import type { RuleNumbers } from '@stellar/domain';

/** Zahlenwerte des Grundspiels. Varianten entstehen durch abgeleitete Objekte. */
export const BASE_RULE_NUMBERS: RuleNumbers = {
  dieSides: 10,
  minPlayers: 3,
  maxPlayers: 6,
  victoryPointOptions: [10, 14],
  commandTokensPerPlayer: 16,
  startingCommandPools: { tactic: 3, fleet: 3, strategy: 2 },
  statusPhaseCommandTokens: 2,
  strategyCardCount: 8,
  strategyCardAllotment: { fewPlayersThreshold: 4, cardsWhenFewPlayers: 2, cardsOtherwise: 1 },
  publicObjectivesPerStage: 5,
  initiallyRevealedObjectives: 2,
  secretObjectivesDealt: 2,
  secretObjectivesKept: 1,
  maxSecretObjectives: 3,
  centerTokenInfluenceCost: 6,
  centerTokenVictoryPoints: 1,
  agendasPerPhase: 2,
  actionCardHandLimit: 7,
};
