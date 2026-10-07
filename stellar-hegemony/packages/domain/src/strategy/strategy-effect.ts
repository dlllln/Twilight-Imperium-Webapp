import type { DecisionContext } from '../eventsourcing/command.ts';
import type { Payment } from '../economy/payment.ts';
import type { GameEvent } from '../game/game-events.ts';
import type { GameState } from '../game/game-state.ts';
import type { PoolCounts } from '../player/command-sheet.ts';
import type { DomainError } from '../shared/domain-error.ts';
import type { PlayerId } from '../shared/ids.ts';
import type { Result } from '../shared/result.ts';
import type { StrategyCardDefinition, StrategyMechanic } from './strategy-card.ts';

/** Entscheidungen des Spielers für die Mechanik „Kommandomarker gewinnen“. */
export interface CommandTokensChoice {
  readonly mechanic: 'commandTokens';
  readonly influence: Payment;
  readonly allocation: PoolCounts;
}

/** Jede Mechanik ergänzt hier ihre Auswahl-Struktur. */
export type StrategyChoice = CommandTokensChoice;

export interface EffectInput {
  readonly state: GameState;
  readonly player: PlayerId;
  readonly card: StrategyCardDefinition;
  readonly choice: StrategyChoice;
  readonly context: DecisionContext;
}

/** Strategy Pattern: Primär- und Sekundärfähigkeit einer Mechanik. */
export interface StrategyEffect {
  readonly mechanic: StrategyMechanic;
  primary(input: EffectInput): Result<readonly GameEvent[], DomainError>;
  secondary(input: EffectInput): Result<readonly GameEvent[], DomainError>;
}
