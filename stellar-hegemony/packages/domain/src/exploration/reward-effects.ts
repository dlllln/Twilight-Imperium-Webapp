import { drawEvents } from '../action-card/draw.ts';
import type { GameEvent } from '../game/game-events.ts';
import { findPlayer, type GameState } from '../game/game-state.ts';
import { unitsOnBoard } from '../objective/board-queries.ts';
import type { ContentPort } from '../ports/content-port.ts';
import type { RandomPort } from '../ports/random-port.ts';
import { ownedOnBoard } from '../production/unit-supply.ts';
import type { PlanetId, PlayerId } from '../shared/ids.ts';
import { UnitNumbering } from '../unit/unit-numbering.ts';
import type { RewardEffect, RewardKind } from './exploration-definition.ts';

/** Lage, in der eine Belohnung geprüft wird. */
export interface RewardSituation {
  readonly state: GameState;
  readonly player: PlayerId;
  /** Planet der Quelle (erkundeter oder legendärer Planet); sonst null. */
  readonly planet: PlanetId | null;
  /** Id der Quelle, z. B. für eingesetzte Einheiten. */
  readonly source: string;
  readonly content: ContentPort;
}

/** Zum Abhandeln kommt der Zufall dazu (Aktionskarten ziehen). */
export interface RewardInput extends RewardSituation {
  readonly random: RandomPort;
}

/** Strategy je Belohnungsart: ob sie gerade etwas bewirkt und welche Events sie erzeugt. */
interface RewardRule<E extends RewardEffect> {
  usable(input: RewardSituation, effect: E): boolean;
  resolve(input: RewardInput, effect: E): readonly GameEvent[];
}

type RewardRules = { readonly [K in RewardKind]: RewardRule<Extract<RewardEffect, { kind: K }>> };

const playerOf = (input: RewardSituation) => findPlayer(input.state, input.player);

const commodityRoom = (input: RewardSituation) => {
  const player = playerOf(input);
  return player === undefined ? 0 : player.commodityLimit - player.commodities;
};

/** RR 24.5: so viele Einheiten, wie der Vorrat noch hergibt. */
type PlaceUnits = Extract<RewardEffect, { kind: 'placeUnits' }>;

function placeable(input: RewardSituation, effect: PlaceUnits) {
  const definition = input.content.units.find(effect.unit, input.player);
  if (definition === undefined) return 0;
  if (definition.componentLimit === 'unlimited') return effect.count;
  const free = definition.componentLimit - ownedOnBoard(input.state, input.player, effect.unit);
  return Math.max(0, Math.min(effect.count, free));
}

/** Einsatz auf dem Planeten der Quelle; ohne Planet oder Vorrat nichts. */
function placement(input: RewardSituation, effect: PlaceUnits): readonly GameEvent[] {
  const count = placeable(input, effect);
  if (input.planet === null || count === 0) return [];
  const units = new UnitNumbering(input.state.nextUnitNumber).create(input.player, [
    { type: effect.unit, count },
  ]);
  const { player, planet, source: ability } = input;
  return [{ type: 'UnitsDeployed', player, ability, planet, units }];
}

const exhaustedOwn = ({ state, player }: RewardSituation) =>
  Object.values(state.planets)
    .filter((planet) => planet.controller === player && planet.exhausted)
    .map((planet) => planet.id);

const reinforcements = (input: RewardSituation) => playerOf(input)?.reinforcementTokens ?? 0;

const ALWAYS = () => true;

const RULES: RewardRules = {
  gainTradeGoods: {
    usable: ALWAYS,
    resolve: ({ player }, { amount }) => [{ type: 'TradeGoodsGained', player, amount }],
  },
  gainCommodities: {
    usable: (input) => commodityRoom(input) > 0,
    resolve: (input, { amount }) => [
      {
        type: 'CommoditiesGained',
        player: input.player,
        amount: Math.min(amount, commodityRoom(input)),
      },
    ],
  },
  drawActionCards: {
    usable: ALWAYS,
    resolve: ({ state, player, random }, { count }) => drawEvents(state, player, count, random),
  },
  placeUnits: {
    usable: (input, effect) => placement(input, effect).length > 0,
    resolve: placement,
  },
  readyPlanets: {
    usable: (input) => exhaustedOwn(input).length > 0,
    resolve: (input) => [
      { type: 'PlanetsReadied', player: input.player, planets: exhaustedOwn(input) },
    ],
  },
  repairUnits: {
    usable: ({ state, player }) => unitsOnBoard(state, player).some((unit) => unit.damaged),
    resolve: ({ player }) => [{ type: 'UnitsRepaired', player }],
  },
  gainCommandTokens: {
    usable: (input) => reinforcements(input) > 0,
    resolve: (input, { amount }) => [
      {
        type: 'CommandTokensGained',
        player: input.player,
        pools: { tactic: Math.min(amount, reinforcements(input)), fleet: 0, strategy: 0 },
      },
    ],
  },
  gainVictoryPoints: {
    usable: ALWAYS,
    resolve: ({ player }, { amount }) => [{ type: 'VictoryPointsGained', player, points: amount }],
  },
};

// TypeScript kann die Art der Belohnung nicht mit der Regel korrelieren.
const ruleOf = (effect: RewardEffect) => RULES[effect.kind] as RewardRule<RewardEffect>;

/** Ob die Belohnung gerade etwas bewirkt (Komponentenaktionen verlangen das, RR 51.3). */
export const rewardUsable = (input: RewardSituation, effect: RewardEffect): boolean =>
  ruleOf(effect).usable(input, effect);

/** Events der Belohnung; ohne Wirkung keine (Erkundung wirkt so weit wie möglich). */
export const rewardEvents = (input: RewardInput, effect: RewardEffect): readonly GameEvent[] =>
  rewardUsable(input, effect) ? ruleOf(effect).resolve(input, effect) : [];
