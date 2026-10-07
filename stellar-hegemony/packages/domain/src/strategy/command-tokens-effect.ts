import { evaluatePayment, type Payment, paymentEvents } from '../economy/payment.ts';
import type { GameEvent } from '../game/game-events.ts';
import { findPlayer } from '../game/game-state.ts';
import { COMMAND_POOLS, type PoolCounts } from '../player/command-sheet.ts';
import { type Check, type DomainError, firstFailure, guard } from '../shared/domain-error.ts';
import { andThen, map, ok, type Result } from '../shared/result.ts';
import {
  choiceOf,
  parameterOf,
  type CommandTokensChoice,
  type EffectInput,
  type StrategyEffect,
} from './strategy-effect.ts';

const total = (pools: PoolCounts): number =>
  COMMAND_POOLS.reduce((sum, pool) => sum + pools[pool], 0);

const validPools = (pools: PoolCounts): boolean =>
  COMMAND_POOLS.every((pool) => Number.isInteger(pools[pool]) && pools[pool] >= 0);

type TokenInput = Omit<EffectInput, 'choice'>;

const parameter = (input: TokenInput, name: string) => parameterOf(input.card, name);

/** RR 29.2/29.3: Grundmenge plus 1 Marker je volle Einflussmenge; begrenzt durch den Nachschub (RR 46.3). */
function tokenCount(
  input: TokenInput,
  influence: Payment,
  base: number,
): Result<number, DomainError> {
  const { state, player, context } = input;
  const spent = evaluatePayment(state, context.content.tiles, player, influence, 'influence');
  const reinforcements = findPlayer(state, player)?.reinforcementTokens ?? 0;
  return andThen(parameter(input, 'influencePerToken'), (perToken) =>
    map(spent, (value) => Math.min(base + Math.floor(value / perToken), reinforcements)),
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

function tokenEvents(input: EffectInput, choice: CommandTokensChoice, base: number) {
  const { player } = input;
  return andThen(tokenCount(input, choice.influence, base), (gained) =>
    map(allocationCheck(choice.allocation, gained), (): readonly GameEvent[] => [
      ...paymentEvents(player, choice.influence),
      ...(gained > 0
        ? [{ type: 'CommandTokensGained', player, pools: choice.allocation } as const]
        : []),
    ]),
  );
}

const gainTokens = (input: EffectInput, base: number): Result<readonly GameEvent[], DomainError> =>
  andThen(choiceOf(input, 'commandTokens'), (choice) => tokenEvents(input, choice, base));

export const commandTokensEffect: StrategyEffect = {
  mechanic: 'commandTokens',
  primary: (input) => andThen(parameter(input, 'tokensGained'), (base) => gainTokens(input, base)),
  secondary: (input) => gainTokens(input, 0),
};

/** Abfrage für Clients: wie viele Marker eine Bezahlung bringen würde (gleiche Regel wie oben). */
export function previewCommandTokens(
  input: TokenInput & { readonly influence: Payment },
  ability: 'primary' | 'secondary',
): Result<number, DomainError> {
  const base = ability === 'primary' ? parameter(input, 'tokensGained') : ok(0);
  return andThen(base, (tokens) => tokenCount(input, input.influence, tokens));
}
