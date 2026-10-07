import type { GameEvent } from '../game/game-events.ts';
import { type DomainError, guard } from '../shared/domain-error.ts';
import { andThen, map, ok, type Result } from '../shared/result.ts';
import { choiceOf, type EffectInput, type StrategyEffect } from './strategy-effect.ts';

type Events = Result<readonly GameEvent[], DomainError>;

/**
 * Primär: Handelswaren erhalten, Rohstoffe auffüllen und ausgewählten Mitspielern
 * die Sekundärfähigkeit ohne Strategiemarker erlauben.
 */
function primary(input: EffectInput): Events {
  const { state, player, card } = input;
  const amount = card.parameters.tradeGoods ?? 0;
  return andThen(choiceOf(input, 'trade'), ({ freeFor }) => {
    const others = state.players.map((p) => p.id).filter((id) => id !== player);
    const valid =
      freeFor.every((id) => others.includes(id)) && new Set(freeFor).size === freeFor.length;
    return map(
      guard(valid, 'trade.invalidPlayer', 'Nur Mitspieler auswählen'),
      (): readonly GameEvent[] => [
        { type: 'TradeGoodsGained', player, amount },
        { type: 'CommoditiesReplenished', player },
        ...(freeFor.length > 0 ? [{ type: 'SecondaryCostWaived', players: freeFor } as const] : []),
      ],
    );
  });
}

/** Sekundär: Rohstoffe auffüllen. */
const secondary = (input: EffectInput): Events =>
  andThen(choiceOf(input, 'trade'), () =>
    ok([{ type: 'CommoditiesReplenished', player: input.player }]),
  );

export const tradeEffect: StrategyEffect = { mechanic: 'trade', primary, secondary };
