import { evaluatePayment, type Payment, paymentEvents } from '../economy/payment.ts';
import type { GameEvent } from '../game/game-events.ts';
import { findPlayer } from '../game/game-state.ts';
import { COMMAND_POOLS, type PoolCounts } from '../player/command-sheet.ts';
import {
  type Check,
  type DomainError,
  domainError,
  firstFailure,
  guard,
} from '../shared/domain-error.ts';
import { andThen, err, map, ok, type Result } from '../shared/result.ts';
import type { EffectInput, StrategyEffect } from './strategy-effect.ts';

const NO_TOKENS: PoolCounts = { tactic: 0, fleet: 0, strategy: 0 };

const total = (pools: PoolCounts): number =>
  COMMAND_POOLS.reduce((sum, pool) => sum + pools[pool], 0);

const validPools = (pools: PoolCounts): boolean =>
  COMMAND_POOLS.every((pool) => Number.isInteger(pools[pool]) && pools[pool] >= 0);

function parameter(input: EffectInput, name: string): Result<number, DomainError> {
  const value = input.card.parameters[name];
  return value === undefined
    ? err(domainError('strategy.parameter', `Parameter fehlt: ${name}`))
    : ok(value);
}

/** RR 29.2/29.3: Grundmenge plus 1 Marker je volle Einflussmenge; begrenzt durch den Nachschub (RR 46.3). */
function tokenCount(input: EffectInput, base: number): Result<number, DomainError> {
  const { state, player, choice, context } = input;
  const spent = evaluatePayment(
    state,
    context.content.tiles,
    player,
    choice.influence,
    'influence',
  );
  const reinforcements = findPlayer(state, player)?.reinforcementTokens ?? 0;
  return andThen(parameter(input, 'influencePerToken'), (perToken) =>
    map(spent, (influence) => Math.min(base + Math.floor(influence / perToken), reinforcements)),
  );
}

function allocationCheck(allocation: PoolCounts, gained: number): Check {
  return firstFailure([
    guard(validPools(allocation), 'tokens.invalidAllocation', 'Ungültige Verteilung'),
    guard(total(allocation) === gained, 'tokens.allocationMismatch', 'Falsche Markerzahl', {
      gained,
    }),
  ]);
}

function gainTokens(input: EffectInput, base: number): Result<readonly GameEvent[], DomainError> {
  const { player, choice } = input;
  return andThen(tokenCount(input, base), (gained) =>
    map(allocationCheck(choice.allocation, gained), (): readonly GameEvent[] => [
      ...paymentEvents(player, choice.influence),
      ...(gained > 0
        ? [{ type: 'CommandTokensGained', player, pools: choice.allocation } as const]
        : []),
    ]),
  );
}

export const commandTokensEffect: StrategyEffect = {
  mechanic: 'commandTokens',
  primary: (input) => andThen(parameter(input, 'tokensGained'), (base) => gainTokens(input, base)),
  secondary: (input) => gainTokens(input, 0),
};

/** Abfrage für Clients: wie viele Marker eine Bezahlung bringen würde (gleiche Regel wie oben). */
export function previewCommandTokens(
  input: Omit<EffectInput, 'choice'> & { readonly influence: Payment },
  ability: 'primary' | 'secondary',
): Result<number, DomainError> {
  const choice = {
    mechanic: 'commandTokens',
    influence: input.influence,
    allocation: NO_TOKENS,
  } as const;
  const effectInput = { ...input, choice };
  const base = ability === 'primary' ? parameter(effectInput, 'tokensGained') : ok(0);
  return andThen(base, (tokens) => tokenCount(effectInput, tokens));
}
