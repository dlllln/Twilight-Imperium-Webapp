import type { DomainError } from '../shared/domain-error.ts';
import type { PlayerId } from '../shared/ids.ts';
import { ok, type Result } from '../shared/result.ts';
import type { RandomPort } from '../ports/random-port.ts';
import type { DomainEvent } from './domain-event.ts';

/** Command Pattern: Absicht eines Spielers, noch nicht validiert. */
export interface Command<T extends string = string> {
  readonly type: T;
  readonly issuedBy: PlayerId;
}

/** Alles Nicht-Deterministische, das eine Entscheidung braucht, wird injiziert. */
export interface DecisionContext {
  readonly random: RandomPort;
  readonly now: number;
}

/**
 * Validiert einen Command gegen den Zustand und erzeugt Events
 * (Single Responsibility: ein Handler pro Command-Typ).
 */
export interface CommandHandler<S, C extends Command, E extends DomainEvent> {
  readonly commandType: C['type'];
  decide(state: S, command: C, context: DecisionContext): Result<readonly E[], DomainError>;
}

export interface Decision<S, E> {
  readonly state: S;
  readonly events: readonly E[];
}

/** Entscheiden und anwenden in einem Schritt (rein funktional). */
export function decideAndApply<S, C extends Command, E extends DomainEvent>(
  handler: CommandHandler<S, C, E>,
  evolve: (state: S, event: E) => S,
  state: S,
  command: C,
  context: DecisionContext,
): Result<Decision<S, E>, DomainError> {
  const decided = handler.decide(state, command, context);
  if (!decided.ok) return decided;
  return ok({ state: decided.value.reduce(evolve, state), events: decided.value });
}
