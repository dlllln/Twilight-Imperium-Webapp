import {
  diplomacySystems,
  type GameCommand,
  type GameState,
  hasCapability,
  isStructure,
  type PlanetId,
  type PlayerId,
  strategyCardId,
  type StrategyCardState,
  type SystemId,
  type UnitTypeId,
} from '@stellar/domain';
import { describe, expect, it } from 'vitest';
import { tryCommand } from '../src/rules-preview.ts';
import { content } from '../src/store.ts';
import { decisionOf } from '../src/table/decision-route.ts';
import {
  type AnySpec,
  type ConstructionPlan,
  type SpecContext,
  TABLE_SPECS,
  type TableAction,
  type TableDraft,
} from '../src/table/table-specs.ts';
import { siteTarget, structureTarget, systemTarget, targetKey } from '../src/table/target-ref.ts';
import { pickAll, started } from './game-helpers.ts';

const EMBASSY = strategyCardId('embassy');
const ENGINEERING = strategyCardId('engineering');

const structures = content.units.all().filter(isStructure);
const CANNON = structures.find((unit) => hasCapability(unit, 'spaceCannon'))?.id as UnitTypeId;
const DOCK = structures.find((unit) => hasCapability(unit, 'production'))?.id as UnitTypeId;

const activeOf = (game: GameState): PlayerId => game.actionPhase?.active as PlayerId;

function contextOf(game: GameState, actor: PlayerId, chosen: typeof EMBASSY): SpecContext {
  const route = decisionOf({ game, actor, waitingOn: null, chosen });
  if (route === null) throw new Error('keine Entscheidung');
  return { game, actor, route };
}

/** Der Spieler bekommt `count` freie Planeten ohne Einheiten dazu. */
function owning(game: GameState, player: PlayerId, count: number): GameState {
  const taken = Object.values(game.planets)
    .filter((planet) => planet.controller === null && planet.units.length === 0)
    .slice(0, count)
    .map((planet) => ({ ...planet, controller: player }));
  return {
    ...game,
    planets: { ...game.planets, ...Object.fromEntries(taken.map((p) => [p.id, p])) },
  };
}

/** Der Spieler hält die Karte und bekommt `count` freie Planeten dazu. */
function holding(game: GameState, card: typeof EMBASSY, player: PlayerId, count = 0): GameState {
  const held = { ...(game.strategyCards[card] as StrategyCardState), holder: player };
  const owned = owning(game, player, count);
  return { ...owned, strategyCards: { ...owned.strategyCards, [card]: held } };
}

/** Nimmt dem Spieler alle Planeten. */
function landless(game: GameState, player: PlayerId): GameState {
  const planets = Object.fromEntries(
    Object.values(game.planets).map((p) => [
      p.id,
      p.controller === player ? { ...p, controller: null } : p,
    ]),
  );
  return { ...game, planets };
}

function primary(card: typeof EMBASSY, count = 0, change = (game: GameState) => game): SpecContext {
  const game = pickAll(started());
  const actor = activeOf(game);
  return contextOf(change(holding(game, card, actor, count)), actor, card);
}

/** Ein anderer Spieler mit einem freien Planeten entscheidet über die Sekundärfähigkeit. */
function constructionSecondary(): SpecContext {
  const game = pickAll(started());
  const turn = game.actionPhase;
  if (turn?.active == null) throw new Error('keine Aktionsphase');
  const actor = game.players.find((player) => player.id !== turn.active)?.id as PlayerId;
  const held = owning(holding(game, ENGINEERING, turn.active), actor, 1);
  const secondary = { card: ENGINEERING, awaiting: [actor], free: [] };
  return contextOf({ ...held, actionPhase: { ...turn, secondary } }, actor, ENGINEERING);
}

const played = (spec: AnySpec, ctx: SpecContext, actions: readonly TableAction[]): TableDraft =>
  actions.reduce((draft, action) => spec.apply(ctx, draft, action), spec.initial(ctx));

const placementsOf = (draft: TableDraft): ConstructionPlan['placements'] =>
  draft.kind === 'construction' ? draft.placements : [];

const probe = (ctx: SpecContext, command: GameCommand) => tryCommand(ctx.game, command);

/** Ein eigener Planet ohne Gebäude: der erste der dazugegebenen. */
const bare = (ctx: SpecContext): PlanetId =>
  Object.values(ctx.game.planets).find(
    (planet) => planet.controller === ctx.actor && planet.units.length === 0,
  )?.id as PlanetId;

const systemOf = (ctx: SpecContext, planet: PlanetId): SystemId =>
  Object.values(ctx.game.systems).find((system) => system.planetIds.includes(planet))
    ?.id as SystemId;

describe('Diplomatie primär am Tisch', () => {
  it('Diplomatie primär: das erste wählbare System ist vorgewählt, nur wählbare lassen sich antippen', () => {
    const ctx = primary(EMBASSY, 2);
    const spec = TABLE_SPECS.diplomacyPrimary;
    const systems = diplomacySystems(ctx.game, ctx.actor, content.tiles);
    expect(systems.length).toBeGreaterThan(1);
    const start = spec.initial(ctx);
    expect(start).toEqual({ kind: 'system', system: systems[0] });
    expect(spec.hint(ctx)).toBe('tableHintDiplomacyPrimary');
    expect(spec.confirm(ctx, start)).toBe('confirm');
    const other = systems[1] as SystemId;
    const moved = spec.apply(ctx, start, { kind: 'system', system: other });
    expect(moved).toEqual({ kind: 'system', system: other });
    expect(spec.targets(ctx, moved).get(targetKey(systemTarget(other)))).toBe('chosen');
    const foreign = Object.keys(ctx.game.systems).find((id) => !systems.includes(id as SystemId));
    expect(spec.apply(ctx, moved, { kind: 'system', system: foreign as SystemId })).toEqual(moved);
  });

  it('Diplomatie primär: die Marker der anderen stehen als Geister im gewählten System', () => {
    const base = primary(EMBASSY, 1);
    const system = diplomacySystems(base.game, base.actor, content.tiles)[0] as SystemId;
    const others = base.game.players.filter((p) => p.id !== base.actor).map((p) => p.id);
    const [marked, ...rest] = others;
    const tile = base.game.systems[system] as GameState['systems'][string];
    const tokens = { ...tile, commandTokens: [marked as PlayerId] };
    const ctx = {
      ...base,
      game: { ...base.game, systems: { ...base.game.systems, [system]: tokens } },
    };
    const ghosts = TABLE_SPECS.diplomacyPrimary.ghosts?.(ctx, { kind: 'system', system });
    expect(ghosts).toEqual(rest.map((player) => ({ system, player })));
  });

  it('Diplomatie primär: wer keinen Marker mehr aufbringen kann, steht nicht als Geist im System', () => {
    const base = primary(EMBASSY, 1);
    const system = diplomacySystems(base.game, base.actor, content.tiles)[0] as SystemId;
    const [broke, ...rest] = base.game.players.filter((p) => p.id !== base.actor).map((p) => p.id);
    const players = base.game.players.map((player) =>
      player.id === broke
        ? { ...player, reinforcementTokens: 0, commandPools: { tactic: 0, fleet: 0, strategy: 0 } }
        : player,
    );
    const ctx = { ...base, game: { ...base.game, players } };
    const ghosts = TABLE_SPECS.diplomacyPrimary.ghosts?.(ctx, { kind: 'system', system });
    expect(ghosts).toEqual(rest.map((player) => ({ system, player })));
  });

  it('Diplomatie primär ohne eigenen Planeten: Ohne System ausführen', () => {
    const ctx = primary(EMBASSY, 0, (game) => landless(game, activeOf(game)));
    const spec = TABLE_SPECS.diplomacyPrimary;
    const draft = spec.initial(ctx);
    expect(draft).toEqual({ kind: 'system', system: null });
    expect(spec.hint(ctx)).toBe('tableHintDiplomacyNone');
    expect(spec.confirm(ctx, draft)).toBe('withoutSystem');
    expect(spec.progress(ctx, draft).ready).toBe(true);
    expect(spec.ghosts?.(ctx, draft)).toEqual([]);
    expect(probe(ctx, spec.command(ctx, draft)).ok).toBe(true);
  });
});

describe('Infrastruktur am Tisch', () => {
  it('Infrastruktur primär: das zweite Gebäude braucht eine Weltraumkanone', () => {
    const ctx = primary(ENGINEERING, 2);
    const spec = TABLE_SPECS.construction;
    const planet = bare(ctx);
    expect(spec.hint(ctx)).toBe('tableHintConstruction');
    expect(spec.confirm(ctx, spec.initial(ctx))).toBe('build');
    expect(spec.progress(ctx, spec.initial(ctx))).toEqual({ done: 0, needed: 2, ready: false });
    const docked = played(spec, ctx, [{ kind: 'place', type: DOCK, planet }]);
    expect(placementsOf(docked)).toEqual([{ type: DOCK, planet }]);
    expect(spec.pieces?.(ctx, docked).map((piece) => piece.type)).toEqual([CANNON]);
    const second = spec.apply(ctx, docked, { kind: 'place', type: DOCK, planet });
    expect(second).toEqual(docked);
    const both = spec.apply(ctx, docked, { kind: 'place', type: CANNON, planet });
    expect(placementsOf(both)).toHaveLength(2);
    expect(spec.progress(ctx, both)).toEqual({ done: 2, needed: 2, ready: true });
    expect(spec.pieces?.(ctx, both)).toEqual([]);
    expect(spec.targets(ctx, both).get(targetKey(siteTarget(planet)))).toBe('chosen');
  });

  it('Infrastruktur primär: ein angetippter Planet bekommt ein Gebäude und gibt es wieder her', () => {
    const ctx = primary(ENGINEERING, 1);
    const spec = TABLE_SPECS.construction;
    const planet = bare(ctx);
    const placed = played(spec, ctx, [{ kind: 'site', planet }]);
    expect(placementsOf(placed).map((p) => p.planet)).toEqual([planet]);
    expect(spec.apply(ctx, placed, { kind: 'site', planet })).toEqual(spec.initial(ctx));
    expect(spec.apply(ctx, placed, { kind: 'unplace', index: 0 })).toEqual(spec.initial(ctx));
  });

  it('Infrastruktur primär: ein Gebäude darf nur dorthin, wo es laut Domain passt', () => {
    const ctx = primary(ENGINEERING, 1);
    const spec = TABLE_SPECS.construction;
    const start = spec.initial(ctx);
    const legal = spec.legal?.(ctx, start, structureTarget(DOCK)) ?? new Set<string>();
    expect(legal.has(targetKey(siteTarget(bare(ctx))))).toBe(true);
    for (const key of legal) expect(spec.targets(ctx, start).get(key)).toBe('legal');
    expect(spec.ghosts?.(ctx, start)).toEqual([]);
  });

  it('Infrastruktur primär ohne jede Stelle: Ausführen ohne Gebäude', () => {
    const ctx = primary(ENGINEERING, 0, (game) => landless(game, activeOf(game)));
    const spec = TABLE_SPECS.construction;
    const draft = spec.initial(ctx);
    expect(spec.confirm(ctx, draft)).toBe('confirm');
    expect(spec.progress(ctx, draft)).toEqual({ done: 0, needed: 0, ready: true });
    expect(spec.command(ctx, draft)).toMatchObject({ choice: { placements: [], system: null } });
  });

  it('Infrastruktur sekundär: genau ein Gebäude, sein System bekommt den eigenen Marker', () => {
    const ctx = constructionSecondary();
    const spec = TABLE_SPECS.construction;
    expect(spec.hint(ctx)).toBe('tableHintConstructionSecondary');
    const sites = [...spec.targets(ctx, spec.initial(ctx)).keys()];
    expect(sites.length).toBeGreaterThan(0);
    const planet = Object.values(ctx.game.planets).find(
      (p) => p.controller === ctx.actor && sites.includes(targetKey(siteTarget(p.id))),
    )?.id as PlanetId;
    const once = played(spec, ctx, [{ kind: 'place', type: CANNON, planet }]);
    const twice = spec.apply(ctx, once, { kind: 'place', type: CANNON, planet });
    expect(placementsOf(twice)).toEqual([{ type: CANNON, planet }]);
    expect(spec.progress(ctx, twice)).toEqual({ done: 1, needed: 1, ready: true });
    const system = systemOf(ctx, planet);
    expect(spec.ghosts?.(ctx, twice)).toEqual([{ system, player: ctx.actor }]);
    expect(spec.command(ctx, twice)).toMatchObject({
      type: 'ResolveSecondary',
      choice: { system },
    });
  });

  it('jeder gebaute Befehl besteht die Probe der Domain', () => {
    const diplomacy = primary(EMBASSY, 2);
    const construction = primary(ENGINEERING, 2);
    const secondary = constructionSecondary();
    const planet = bare(construction);
    const cases: readonly [AnySpec, SpecContext, readonly TableAction[]][] = [
      [TABLE_SPECS.diplomacyPrimary, diplomacy, []],
      [TABLE_SPECS.diplomacyPrimary, primary(EMBASSY, 0, (g) => landless(g, activeOf(g))), []],
      [TABLE_SPECS.construction, construction, [{ kind: 'site', planet }]],
      [
        TABLE_SPECS.construction,
        construction,
        [
          { kind: 'place', type: DOCK, planet },
          { kind: 'place', type: CANNON, planet },
        ],
      ],
      [TABLE_SPECS.construction, primary(ENGINEERING, 0, (g) => landless(g, activeOf(g))), []],
      [TABLE_SPECS.construction, secondary, [{ kind: 'site', planet: bare(secondary) }]],
    ];
    for (const [spec, ctx, actions] of cases) {
      const draft = played(spec, ctx, actions);
      expect(spec.progress(ctx, draft).ready).toBe(true);
      expect(probe(ctx, spec.command(ctx, draft)).ok).toBe(true);
    }
  });
});
