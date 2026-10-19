import {
  type ConstructionSite,
  constructionSites,
  hasCapability,
  type PlanetId,
  type StructurePlacement,
  type SystemId,
  systemOfPlanet,
  type UnitTypeId,
} from '@stellar/domain';
import { content } from '../store.ts';
import { strategyCommand } from './spec-pools.ts';
import type {
  ConstructionPlan,
  GhostToken,
  Progress,
  SpecContext,
  TableAction,
  TablePiece,
  TableSpec,
} from './spec-types.ts';
import {
  siteTarget,
  structureTarget,
  type TargetRef,
  targetKey,
  type TargetState,
} from './target-ref.ts';

/*
 * Infrastruktur (RR 39) am Tisch: Gebäude aus dem Bauvorrat auf eigene Planeten ziehen, oder
 * einen Planeten antippen. Primär bis zu zwei, das zweite mit Weltraumkanone; sekundär genau
 * eines, und das System folgt aus dem Planeten. Welche Stellen es gibt, sagt die Domain.
 */

export type ConstructionSpec = TableSpec<ConstructionPlan, TableAction>;

const secondary = (ctx: SpecContext): boolean => ctx.route.ability === 'secondary';

const abilityOf = (ctx: SpecContext) => (secondary(ctx) ? 'secondary' : 'primary');

/** Höchstzahl der Gebäude: primär laut Karte, sekundär eines. */
function mostOf(ctx: SpecContext): number {
  if (secondary(ctx)) return 1;
  const card = content.strategyCards.find((entry) => entry.id === ctx.route.card);
  return card?.parameters['structures'] ?? 1;
}

const isCannon = (type: UnitTypeId): boolean => {
  const definition = content.units.find(type);
  return definition !== undefined && hasCapability(definition, 'spaceCannon');
};

/** Stellen laut Domain; primär zählen die vorgemerkten Gebäude mit, sekundär ersetzt ein neues. */
const sitesOf = (ctx: SpecContext, planned: readonly StructurePlacement[]) =>
  constructionSites(ctx.game, ctx.actor, content.units, abilityOf(ctx), planned);

/** Was jetzt noch passt: primär ist nach dem ersten Gebäude nur Weltraumkanone erlaubt. */
function openSites(ctx: SpecContext, draft: ConstructionPlan): readonly ConstructionSite[] {
  if (secondary(ctx)) return sitesOf(ctx, []);
  const count = draft.placements.length;
  if (count >= mostOf(ctx)) return [];
  const sites = sitesOf(ctx, draft.placements);
  if (count === 0) return sites;
  return sites
    .map((site) => ({ ...site, types: site.types.filter(isCannon) }))
    .filter((site) => site.types.length > 0);
}

const typesAt = (ctx: SpecContext, draft: ConstructionPlan, planet: PlanetId) =>
  openSites(ctx, draft).find((site) => site.planet === planet)?.types ?? [];

function place(ctx: SpecContext, draft: ConstructionPlan, type: UnitTypeId, planet: PlanetId) {
  if (!typesAt(ctx, draft, planet).includes(type)) return draft;
  const placement = { type, planet };
  const placements = secondary(ctx) ? [placement] : [...draft.placements, placement];
  return { ...draft, placements };
}

const unplace = (draft: ConstructionPlan, index: number): ConstructionPlan => ({
  ...draft,
  placements: draft.placements.filter((_placement, at) => at !== index),
});

/** Ein Planet wird angetippt: sein letztes Gebäude zurücknehmen, sonst das erste passende setzen. */
function toggled(ctx: SpecContext, draft: ConstructionPlan, planet: PlanetId): ConstructionPlan {
  const index = draft.placements.findLastIndex((placement) => placement.planet === planet);
  if (index >= 0) return unplace(draft, index);
  const [first] = typesAt(ctx, draft, planet);
  return first === undefined ? draft : place(ctx, draft, first, planet);
}

function apply(ctx: SpecContext, draft: ConstructionPlan, action: TableAction): ConstructionPlan {
  if (action.kind === 'site') return toggled(ctx, draft, action.planet);
  if (action.kind === 'place') return place(ctx, draft, action.type, action.planet);
  return action.kind === 'unplace' ? unplace(draft, action.index) : draft;
}

function targets(ctx: SpecContext, draft: ConstructionPlan): ReadonlyMap<string, TargetState> {
  const states = new Map<string, TargetState>();
  for (const site of openSites(ctx, draft)) states.set(targetKey(siteTarget(site.planet)), 'legal');
  for (const { planet } of draft.placements) states.set(targetKey(siteTarget(planet)), 'chosen');
  return states;
}

/** Primär ohne jede Stelle bleibt die Karte ohne Wirkung (RR 27.11); sonst mindestens eines. */
const noSite = (ctx: SpecContext): boolean => !secondary(ctx) && sitesOf(ctx, []).length === 0;

function progress(ctx: SpecContext, draft: ConstructionPlan): Progress {
  const done = draft.placements.length;
  const fewest = noSite(ctx) ? 0 : 1;
  const most = noSite(ctx) ? 0 : mostOf(ctx);
  return { done, needed: most, ready: done >= fewest && done <= most };
}

/** Sekundär: das System des gesetzten Gebäudes; primär keines. */
function chosenSystem(ctx: SpecContext, draft: ConstructionPlan): SystemId | null {
  const [placement] = draft.placements;
  return secondary(ctx) && placement !== undefined
    ? (systemOfPlanet(ctx.game, placement.planet)?.id ?? null)
    : null;
}

/** Die Gebäudearten, die jetzt irgendwo passen, als Stücke im Bauvorrat. */
function pieces(ctx: SpecContext, draft: ConstructionPlan): readonly TablePiece[] {
  const types = new Set(openSites(ctx, draft).flatMap((site) => site.types));
  return [...types].map((type) => ({
    ref: structureTarget(type),
    type,
    owner: ctx.actor,
    at: null,
  }));
}

function legal(ctx: SpecContext, draft: ConstructionPlan, piece: TargetRef): ReadonlySet<string> {
  if (piece.kind !== 'structure') return new Set();
  const sites = openSites(ctx, draft).filter((site) => site.types.includes(piece.type));
  return new Set(sites.map((site) => targetKey(siteTarget(site.planet))));
}

/** Sekundär: der eigene Marker, der aus dem Nachschub in das System kommt. */
function ghosts(ctx: SpecContext, draft: ConstructionPlan): readonly GhostToken[] {
  const system = chosenSystem(ctx, draft);
  return system === null ? [] : [{ system, player: ctx.actor }];
}

export const CONSTRUCTION_SPEC: ConstructionSpec = {
  id: 'construction',
  hint: (ctx) => (secondary(ctx) ? 'tableHintConstructionSecondary' : 'tableHintConstruction'),
  confirm: (ctx) => (noSite(ctx) ? 'confirm' : 'build'),
  initial: () => ({ kind: 'construction', placements: [] }),
  apply,
  targets,
  progress,
  command: (ctx, draft) =>
    strategyCommand(ctx, {
      mechanic: 'construction',
      placements: draft.placements,
      system: chosenSystem(ctx, draft),
    }),
  pieces,
  legal,
  ghosts,
};
