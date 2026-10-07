import type { DecisionContext } from '../eventsourcing/command.ts';
import { drawEvents } from '../action-card/draw.ts';
import { findPlanetDefinition } from '../economy/payment.ts';
import { findPlayer, type GameState } from '../game/game-state.ts';
import type { GameEvent } from '../game/game-events.ts';
import { homeSystemIdOf, systemOfPlanet } from '../objective/board-queries.ts';
import { drawSecretEvents } from '../objective/objective-scoring.ts';
import type { PoolCounts } from '../player/command-sheet.ts';
import { shuffle } from '../ports/random-port.ts';
import type { ContentPort } from '../ports/content-port.ts';
import type { PlanetId, PlayerId } from '../shared/ids.ts';
import { UnitNumbering } from '../unit/unit-numbering.ts';
import type { AgendaEffect, AgendaEffectKind } from './agenda-definition.ts';

/** Lage beim Abhandeln einer Wirkung für einen Empfänger. */
export interface AgendaEffectInput<E extends AgendaEffect = AgendaEffect> {
  readonly state: GameState;
  readonly player: PlayerId;
  readonly effect: E;
  /** Der gewählte Planet, wenn über einen Planeten abgestimmt wurde. */
  readonly planet: PlanetId | null;
  readonly context: DecisionContext;
}

type EffectRule<E extends AgendaEffect> = (input: AgendaEffectInput<E>) => readonly GameEvent[];

type EffectTable = {
  readonly [K in AgendaEffectKind]: EffectRule<Extract<AgendaEffect, { kind: K }>>;
};

const NO_POOLS: PoolCounts = { tactic: 0, fleet: 0, strategy: 0 };

const playerOf = (state: GameState, id: PlayerId) => findPlayer(state, id);

const onlyIf = (amount: number, event: GameEvent): readonly GameEvent[] =>
  amount > 0 ? [event] : [];

/** Ein Planet des Heimatsystems, den der Spieler kontrolliert. */
function homePlanet(state: GameState, player: PlayerId, content: ContentPort): PlanetId | null {
  const home = state.systems[homeSystemIdOf(state, player, content) ?? ''];
  const planets = home?.planetIds ?? [];
  return planets.find((planet) => state.planets[planet]?.controller === player) ?? null;
}

const traitPlanets = (
  input: AgendaEffectInput<Extract<AgendaEffect, { kind: 'exhaustPlanets' }>>,
) =>
  Object.values(input.state.planets)
    .filter((planet) => planet.controller === input.player && !planet.exhausted)
    .filter(
      (planet) =>
        findPlanetDefinition(input.context.content.tiles, planet.id)?.trait === input.effect.trait,
    )
    .map((planet) => planet.id);

function placement(input: AgendaEffectInput<Extract<AgendaEffect, { kind: 'placeUnits' }>>) {
  const { state, player, effect, planet, context } = input;
  const target =
    effect.where === 'electedPlanet' ? planet : homePlanet(state, player, context.content);
  const system = target === null ? undefined : systemOfPlanet(state, target);
  if (target === null || system === undefined) return [];
  const ground = new UnitNumbering(state.nextUnitNumber).create(player, [
    { type: effect.unit, count: effect.count },
  ]);
  return [
    {
      type: 'UnitsProduced',
      player,
      system: system.id,
      space: [],
      planet: target,
      ground,
    } as const,
  ];
}

function structuresOn(input: AgendaEffectInput): readonly GameEvent[] {
  const { state, planet, context } = input;
  const system = planet === null ? undefined : systemOfPlanet(state, planet);
  const units = (planet === null ? [] : (state.planets[planet]?.units ?? [])).filter(
    (unit) => context.content.units.find(unit.type)?.category === 'structure',
  );
  if (system === undefined || units.length === 0) return [];
  return [{ type: 'UnitsDestroyed', system: system.id, units: units.map((unit) => unit.id) }];
}

/** Interpreter je Wirkungsart; die Empfänger bestimmt der Aufrufer. */
const EFFECTS: EffectTable = {
  gainTradeGoods: ({ player, effect }) => [
    { type: 'TradeGoodsGained', player, amount: effect.amount },
  ],
  loseTradeGoods: ({ state, player, effect }) => {
    const amount = Math.min(effect.amount, playerOf(state, player)?.tradeGoods ?? 0);
    return onlyIf(amount, { type: 'TradeGoodsSpent', player, amount });
  },
  replenishCommodities: ({ state, player }) => {
    const own = playerOf(state, player);
    const missing = (own?.commodityLimit ?? 0) - (own?.commodities ?? 0);
    return onlyIf(missing, { type: 'CommoditiesReplenished', player });
  },
  gainCommandTokens: ({ state, player, effect }) => {
    const amount = Math.min(effect.amount, playerOf(state, player)?.reinforcementTokens ?? 0);
    const pools = { ...NO_POOLS, [effect.pool]: amount };
    return onlyIf(amount, { type: 'CommandTokensGained', player, pools });
  },
  loseCommandTokens: ({ state, player, effect }) => {
    const held = playerOf(state, player)?.commandPools[effect.pool] ?? 0;
    const amount = Math.min(effect.amount, held);
    return onlyIf(amount, { type: 'CommandTokensLost', player, pool: effect.pool, amount });
  },
  drawActionCards: ({ state, player, effect, context }) =>
    drawEvents(state, player, effect.count, context.random),
  discardActionCards: ({ state, player, effect, context }) => {
    const hand = playerOf(state, player)?.actionCards ?? [];
    const cards = shuffle(context.random, hand).slice(0, effect.count ?? hand.length);
    return onlyIf(cards.length, { type: 'ActionCardsDiscarded', player, cards });
  },
  drawSecretObjective: ({ state, player }) => drawSecretEvents(state, player),
  gainVictoryPoints: ({ player, effect }) => [
    { type: 'VictoryPointsGained', player, points: effect.amount },
  ],
  exhaustPlanets: (input) => {
    const planets = traitPlanets(input);
    return onlyIf(planets.length, { type: 'PlanetsExhausted', player: input.player, planets });
  },
  repairUnits: ({ player }) => [{ type: 'UnitsRepaired', player }],
  placeUnits: placement,
  destroyStructures: structuresOn,
  repealLaws: ({ state }) => onlyIf(state.laws.length, { type: 'LawsRepealed' }),
};

// TypeScript kann die Art der Wirkung nicht mit der Regel korrelieren.
export const agendaEffectEvents = (input: AgendaEffectInput): readonly GameEvent[] =>
  (EFFECTS[input.effect.kind] as EffectRule<AgendaEffect>)(input);
