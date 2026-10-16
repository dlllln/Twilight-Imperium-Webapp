import type { GameEvent } from '../game/game-events.ts';
import { findPlayer, type GameState } from '../game/game-state.ts';
import { CommandSheet } from '../player/command-sheet.ts';
import { productionEvents } from '../production/production.ts';
import { type DomainError, domainError } from '../shared/domain-error.ts';
import type { PlayerId, SystemId } from '../shared/ids.ts';
import { andThen, err, map, ok, type Result } from '../shared/result.ts';
import { choiceOf, type EffectInput, type StrategyEffect } from './strategy-effect.ts';

type Events = Result<readonly GameEvent[], DomainError>;

/** Kriegsführung primär (RR 49.1): Systeme, aus denen ein eigener Marker zurückkommen kann. */
export const warfareTokenSystems = (state: GameState, player: PlayerId): readonly SystemId[] =>
  Object.values(state.systems)
    .filter((system) => system.commandTokens.includes(player))
    .map((system) => system.id);

const tokensOnBoard = (input: EffectInput): boolean =>
  warfareTokenSystems(input.state, input.player).length > 0;

/** RR 27.11: Liegt kein eigener Marker auf dem Plan, wird nur umverteilt. */
function returnedToken(input: EffectInput, system: SystemId | null): Result<boolean, DomainError> {
  const hasToken =
    system !== null && input.state.systems[system]?.commandTokens.includes(input.player) === true;
  if (hasToken || (system === null && !tokensOnBoard(input))) return ok(hasToken);
  return err(domainError('warfare.noToken', 'Dort liegt kein eigener Marker'));
}

/** Primär (RR 49.1/49.2): einen eigenen Marker vom Plan auf die Tafel nehmen, dann neu verteilen. */
function primary(input: EffectInput): Events {
  const { state, player } = input;
  return andThen(choiceOf(input, 'warfare'), ({ system, pools }) =>
    andThen(returnedToken(input, system), (returned) => {
      const current = findPlayer(state, player)?.commandPools ?? pools;
      const gained = returned ? 1 : 0;
      const sheet = andThen(CommandSheet.of(current), (s) =>
        s.gain('tactic', gained).redistribute(pools),
      );
      const back =
        returned && system !== null
          ? [{ type: 'CommandTokenReturned', player, system } as const]
          : [];
      return map(sheet, (): readonly GameEvent[] => [
        ...back,
        { type: 'CommandTokensRedistributed', player, pools },
      ]);
    }),
  );
}

/** Heimatsystem laut Fraktion (Information Expert: die Fraktionsdaten kennen es). */
function homeSystemOf(input: EffectInput): SystemId | undefined {
  const faction = findPlayer(input.state, input.player)?.faction;
  const home = input.context.content.factions.find((f) => f.id === faction)?.homeSystem.id;
  return home !== undefined && input.state.systems[home] !== undefined ? home : undefined;
}

/** Sekundär: Produktion im eigenen Heimatsystem, ohne es zu aktivieren. */
function secondary(input: EffectInput): Events {
  return andThen(choiceOf(input, 'warfare'), ({ production }) => {
    const home = homeSystemOf(input);
    if (production === null || home === undefined)
      return err(domainError('warfare.noProduction', 'Produktion im Heimatsystem angeben'));
    const { state, player, context: decision } = input;
    return productionEvents({ state, system: home, player, request: production, decision });
  });
}

export const warfareEffect: StrategyEffect = { mechanic: 'warfare', primary, secondary };
