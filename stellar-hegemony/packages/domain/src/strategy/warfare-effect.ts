import type { GameEvent } from '../game/game-events.ts';
import { findPlayer } from '../game/game-state.ts';
import { CommandSheet } from '../player/command-sheet.ts';
import { productionEvents } from '../production/production.ts';
import { type DomainError, domainError } from '../shared/domain-error.ts';
import type { SystemId } from '../shared/ids.ts';
import { andThen, err, map, type Result } from '../shared/result.ts';
import { choiceOf, type EffectInput, type StrategyEffect } from './strategy-effect.ts';

type Events = Result<readonly GameEvent[], DomainError>;

/** Primär (RR 49.1/49.2): einen eigenen Marker vom Plan auf die Tafel nehmen, dann neu verteilen. */
function primary(input: EffectInput): Events {
  const { state, player } = input;
  return andThen(choiceOf(input, 'warfare'), ({ system, pools }) => {
    const hasToken =
      system !== null && state.systems[system]?.commandTokens.includes(player) === true;
    if (system === null || !hasToken)
      return err(domainError('warfare.noToken', 'Dort liegt kein eigener Marker'));
    const current = findPlayer(state, player)?.commandPools ?? pools;
    const sheet = andThen(CommandSheet.of(current), (s) => s.gain('tactic', 1).redistribute(pools));
    return map(sheet, (): readonly GameEvent[] => [
      { type: 'CommandTokenReturned', player, system },
      { type: 'CommandTokensRedistributed', player, pools },
    ]);
  });
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
