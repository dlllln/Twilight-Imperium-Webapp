import { findPlayer, type GameState } from '../game/game-state.ts';
import type { PoolCounts } from '../player/command-sheet.ts';
import type { PlayerId } from '../shared/ids.ts';
import { neighborsOf } from '../transaction/neighbors.ts';
import { drawEvents } from './draw.ts';
import { type EffectRules, NO_OPTIONS } from './effect-rule.ts';

const NO_POOLS: PoolCounts = { tactic: 0, fleet: 0, strategy: 0 };

const own = ({ state, player }: { readonly state: GameState; readonly player: PlayerId }) =>
  findPlayer(state, player);

const tradeGoodsOf = (state: GameState, player: PlayerId) =>
  findPlayer(state, player)?.tradeGoods ?? 0;

/** Wirkungen auf Handelswaren, Rohstoffe, Marker und Handkarten. */
export const ECONOMY_EFFECTS = {
  gainTradeGoods: {
    targets: () => NO_OPTIONS,
    resolve: ({ player, effect }) => [{ type: 'TradeGoodsGained', player, amount: effect.amount }],
  },
  replenishCommodities: {
    targets: () => NO_OPTIONS,
    usable: (situation) => {
      const player = own(situation);
      return player !== undefined && player.commodities < player.commodityLimit;
    },
    resolve: ({ player }) => [{ type: 'CommoditiesReplenished', player }],
  },
  gainCommandTokens: {
    targets: () => ({ pool: true }),
    usable: (situation) => (own(situation)?.reinforcementTokens ?? 0) > 0,
    resolve: ({ state, player, effect, target }) => {
      const gained = Math.min(effect.amount, findPlayer(state, player)?.reinforcementTokens ?? 0);
      return [
        { type: 'CommandTokensGained', player, pools: { ...NO_POOLS, [target.pool]: gained } },
      ];
    },
  },
  drawActionCards: {
    targets: () => NO_OPTIONS,
    resolve: ({ state, player, effect, random }) => drawEvents(state, player, effect.count, random),
  },
  stealTradeGoods: {
    targets: ({ state, player }) => ({
      players: neighborsOf(state, player).filter((other) => tradeGoodsOf(state, other) > 0),
    }),
    resolve: ({ state, player, effect, target }) =>
      target.players.flatMap((victim) => {
        const amount = Math.min(effect.amount, tradeGoodsOf(state, victim));
        return [
          { type: 'TradeGoodsSpent', player: victim, amount } as const,
          { type: 'TradeGoodsGained', player, amount } as const,
        ];
      }),
  },
  tradeGoodsPerNeighbor: {
    targets: () => NO_OPTIONS,
    usable: ({ state, player }) => neighborsOf(state, player).length > 0,
    resolve: ({ state, player, effect }) => [
      {
        type: 'TradeGoodsGained',
        player,
        amount: effect.amount * neighborsOf(state, player).length,
      },
    ],
  },
} as const satisfies Pick<
  EffectRules,
  | 'gainTradeGoods'
  | 'replenishCommodities'
  | 'gainCommandTokens'
  | 'drawActionCards'
  | 'stealTradeGoods'
  | 'tradeGoodsPerNeighbor'
>;
