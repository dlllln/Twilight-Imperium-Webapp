import { type PlanetId, readyablePlanets } from '@stellar/domain';
import { content } from '../store.ts';
import { planetStates, type PlanetSide } from './planet-table.ts';
import { strategyCommand } from './spec-pools.ts';
import type { ReadyPlan, SpecContext, TableAction, TableSpec } from './spec-types.ts';

/*
 * Diplomatie sekundär (RR 21.3): erschöpfte eigene Planeten antippen, höchstens so viele, wie die
 * Karte erlaubt. Die Domain nennt die Planeten; hier wird nur gezählt.
 */

export type ReadySpec = TableSpec<ReadyPlan, TableAction>;

const limitOf = (ctx: SpecContext): number =>
  content.strategyCards.find((card) => card.id === ctx.route.card)?.parameters.readyPlanets ?? 0;

function toggled(ctx: SpecContext, draft: ReadyPlan, planet: PlanetId): ReadyPlan {
  if (draft.planets.includes(planet))
    return { ...draft, planets: draft.planets.filter((id) => id !== planet) };
  const open = draft.planets.length < limitOf(ctx);
  const readyable = readyablePlanets(ctx.game, ctx.actor).includes(planet);
  return open && readyable ? { ...draft, planets: [...draft.planets, planet] } : draft;
}

/* Mehr als die erschöpften Planeten kann niemand bereitmachen. */
const neededOf = (ctx: SpecContext): number =>
  Math.min(limitOf(ctx), readyablePlanets(ctx.game, ctx.actor).length);

const planets = (ctx: SpecContext, draft: ReadyPlan): PlanetSide => ({
  mode: 'ready',
  currency: null,
  chosen: draft.planets,
  offered: readyablePlanets(ctx.game, ctx.actor),
  limit: limitOf(ctx),
  tradeGoods: null,
  required: null,
});

export const DIPLOMACY_SPEC: ReadySpec = {
  id: 'diplomacy',
  hint: () => 'tableHintDiplomacy',
  confirm: () => 'readyPlanets',
  initial: () => ({ kind: 'ready', planets: [] }),
  apply: (ctx, draft, action) =>
    action.kind === 'planet' ? toggled(ctx, draft, action.planet) : draft,
  targets: (ctx, draft) => planetStates(planets(ctx, draft)),
  progress: (ctx, draft) => ({ done: draft.planets.length, needed: neededOf(ctx), ready: true }),
  command: (ctx, draft) =>
    strategyCommand(ctx, { mechanic: 'diplomacy', system: null, planets: draft.planets }),
  planets,
};
