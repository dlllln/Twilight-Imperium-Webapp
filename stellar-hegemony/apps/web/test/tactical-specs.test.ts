import {
  adjacentSystemIds,
  type GameCommand,
  type GameState,
  type PlanetId,
  type PlayerId,
  type SystemId,
  type TacticalStep,
  type Unit,
  unitId,
  unitTypeId,
  updatePlayer,
} from '@stellar/domain';
import { describe, expect, it } from 'vitest';
import { homeSystemOf } from '../src/card-view.ts';
import { tryCommand } from '../src/rules-preview.ts';
import { content } from '../src/store.ts';
import { decisionOf } from '../src/table/decision-route.ts';
import {
  type AnySpec,
  type SpecContext,
  TABLE_SPECS,
  type TableAction,
  type TableDraft,
} from '../src/table/table-specs.ts';
import {
  parseTargetKey,
  planetTarget,
  SPACE,
  siteTarget,
  structureTarget,
  targetKey,
  unitTarget,
} from '../src/table/target-ref.ts';
import { dropIntent } from '../src/table/use-drop-router.ts';
import { pickAll, started } from './game-helpers.ts';

const figure = (id: string, type: string, owner: PlayerId): Unit => ({
  id: unitId(id),
  type: unitTypeId(type),
  owner,
  damaged: false,
});

/** Ein Nachbarsystem der Heimat mit freiem Planeten und ohne Anomalie. */
function freeWorldNear(state: GameState, player: PlayerId): SystemId {
  const home = state.systems[homeSystemOf(state, player, content) ?? ''];
  if (home === undefined) throw new Error('keine Heimat');
  const found = adjacentSystemIds(state.systems, home).find((id) => {
    const system = state.systems[id];
    return (
      system?.anomaly === undefined &&
      system?.planetIds.some((planet) => state.planets[planet]?.controller === null) === true
    );
  });
  if (found === undefined) throw new Error('kein freier Planet');
  return found;
}

const centerSystem = (state: GameState): SystemId => {
  const found = Object.values(state.systems).find(
    (system) => content.tiles.find(system.id)?.back === 'center',
  );
  if (found === undefined) throw new Error('kein Zentrum');
  return found.id;
};

interface Scene {
  readonly ctx: SpecContext;
  readonly planet: PlanetId;
}

/** Der Aktive steht mit `units` im Weltraum von `system`, die taktische Aktion ist bei `step`. */
function sceneAt(
  state: GameState,
  system: SystemId,
  step: TacticalStep,
  units: (player: PlayerId) => readonly Unit[],
): Scene {
  const actor = state.actionPhase?.active as PlayerId;
  const tile = state.systems[system] as GameState['systems'][string];
  const tactical = { system, step, pendingHits: [], combat: null, windows: [], bonuses: [] };
  const game: GameState = {
    ...state,
    systems: { ...state.systems, [system]: { ...tile, spaceUnits: units(actor) } },
    actionPhase: state.actionPhase && { ...state.actionPhase, tactical },
  };
  const route = decisionOf({ game, actor, waitingOn: null, chosen: null });
  if (route === null) throw new Error('keine Entscheidung');
  return { ctx: { game, actor, route }, planet: tile.planetIds[0] as PlanetId };
}

/** Ein Schlachtschiff über einem fremden Planeten mit gegnerischer Infanterie. */
function bombarding(): Scene {
  const state = pickAll(started());
  const actor = state.actionPhase?.active as PlayerId;
  const enemy = state.players.find((p) => p.id !== actor)?.id as PlayerId;
  const system = freeWorldNear(state, actor);
  const planet = state.systems[system]?.planetIds[0] as PlanetId;
  const world = state.planets[planet] as GameState['planets'][string];
  const defender = figure('feind', 'infantry', enemy);
  const held = { ...state.planets, [planet]: { ...world, controller: enemy, units: [defender] } };
  return sceneAt({ ...state, planets: held }, system, 'bombardment', (owner) => [
    figure('bs', 'dreadnought', owner),
  ]);
}

const troops = (owner: PlayerId): readonly Unit[] => [
  figure('traeger', 'carrier', owner),
  figure('inf-1', 'infantry', owner),
  figure('inf-2', 'infantry', owner),
];

function landing(): Scene {
  const state = pickAll(started());
  return sceneAt(
    state,
    freeWorldNear(state, state.actionPhase?.active as PlayerId),
    'invasion',
    troops,
  );
}

/** Landung im Zentrum: Der Marker der Thronwelt kostet Einfluss, Handelswaren sind da. */
function throneLanding(): Scene {
  const base = pickAll(started());
  const state = updatePlayer(base, base.actionPhase?.active as PlayerId, (p) => ({
    ...p,
    tradeGoods: 6,
  }));
  return sceneAt(state, centerSystem(state), 'invasion', troops);
}

/** Alle Schritte sind erledigt; es bleibt das Beenden. */
function done(): SpecContext {
  const state = pickAll(started());
  const system = freeWorldNear(state, state.actionPhase?.active as PlayerId);
  return sceneAt(state, system, 'done', () => []).ctx;
}

const played = (spec: AnySpec, ctx: SpecContext, actions: readonly TableAction[]): TableDraft =>
  actions.reduce((draft, action) => spec.apply(ctx, draft, action), spec.initial(ctx));

const site = (planet: PlanetId): TableAction => ({ kind: 'site', planet });
const coins = (count: number): TableAction[] =>
  Array.from({ length: count }, () => ({ kind: 'tradeGoods', delta: 1 }) as const);
const probe = (ctx: SpecContext, command: GameCommand) => tryCommand(ctx.game, command);

describe('Taktische Aktion am Tisch: Bombardement, Landung, Ende', () => {
  it('Bombardement: ohne Zuweisung geht es ohne Bombardement weiter', () => {
    const { ctx } = bombarding();
    const spec = TABLE_SPECS.bombard;
    const draft = spec.initial(ctx);
    expect(draft).toEqual({ kind: 'placement', assignments: {}, payment: null });
    expect(spec.hint(ctx)).toBe('tableHintBombard');
    expect(spec.confirm(ctx, draft)).toBe('skipBombardment');
    expect(spec.alternative?.(ctx, draft)).toBeNull();
    expect(spec.command(ctx, draft)).toEqual({ type: 'Bombard', issuedBy: ctx.actor, targets: [] });
  });

  it('Bombardement: ein angetippter Planet bekommt das Schiff, der Ausweg bleibt Ohne Bombardement weiter', () => {
    const { ctx, planet } = bombarding();
    const spec = TABLE_SPECS.bombard;
    const draft = played(spec, ctx, [site(planet)]);
    expect(spec.confirm(ctx, draft)).toBe('bombard');
    expect(spec.targets(ctx, draft).get(targetKey(siteTarget(planet)))).toBe('chosen');
    expect(spec.command(ctx, draft)).toEqual({
      type: 'Bombard',
      issuedBy: ctx.actor,
      targets: [{ unit: unitId('bs'), planet }],
    });
    expect(spec.alternative?.(ctx, draft)).toEqual({
      label: 'skipBombardment',
      command: { type: 'Bombard', issuedBy: ctx.actor, targets: [] },
    });
    expect(spec.pieces?.(ctx, draft)).toEqual([
      { ref: unitTarget('bs'), type: unitTypeId('dreadnought'), owner: ctx.actor, at: planet },
    ]);
  });

  it('Bombardement: ein Schiff darf auf erlaubte Planeten und, zugewiesen, zurück in den Weltraum', () => {
    const { ctx, planet } = bombarding();
    const spec = TABLE_SPECS.bombard;
    const start = spec.initial(ctx);
    const ship = unitTarget('bs');
    expect([...(spec.legal?.(ctx, start, ship) ?? [])]).toEqual([targetKey(siteTarget(planet))]);
    const placed = spec.apply(ctx, start, { kind: 'assign', unit: unitId('bs'), planet });
    expect(spec.legal?.(ctx, placed, ship).has(targetKey(SPACE))).toBe(true);
    const back = spec.apply(ctx, placed, { kind: 'assign', unit: unitId('bs'), planet: null });
    expect(back).toEqual(start);
    expect(spec.legal?.(ctx, start, unitTarget('fremd')).size).toBe(0);
  });

  it('Landung: Bodentruppen gehen nacheinander auf den angetippten Planeten', () => {
    const { ctx, planet } = landing();
    const spec = TABLE_SPECS.landing;
    expect(spec.confirm(ctx, spec.initial(ctx))).toBe('skipInvasion');
    const draft = played(spec, ctx, [site(planet), site(planet)]);
    expect(spec.confirm(ctx, draft)).toBe('land');
    expect(spec.progress(ctx, draft)).toEqual({ done: 2, needed: 2, ready: true });
    expect(spec.planets?.(ctx, draft)).toBeNull();
    expect(spec.pieces?.(ctx, draft).map((piece) => piece.at)).toEqual([planet, planet]);
    const freed = spec.apply(ctx, draft, site(planet));
    expect(spec.progress(ctx, freed).done).toBe(1);
  });

  it('Landung auf der Thronwelt ist erst bezahlt bereit', () => {
    const { ctx, planet } = throneLanding();
    const spec = TABLE_SPECS.landing;
    expect(spec.initial(ctx)).toEqual({ kind: 'placement', assignments: {}, payment: null });
    const landed = played(spec, ctx, [site(planet)]);
    expect(spec.planets?.(ctx, landed)).toMatchObject({ mode: 'pay', currency: 'influence' });
    expect(spec.progress(ctx, landed)).toEqual({ done: 0, needed: 6, ready: false });
    expect(probe(ctx, spec.command(ctx, landed)).ok).toBe(false);
    const paid = played(spec, ctx, [site(planet), ...coins(6)]);
    expect(spec.progress(ctx, paid)).toEqual({ done: 6, needed: 6, ready: true });
    expect(probe(ctx, spec.command(ctx, paid)).ok).toBe(true);
    const back = spec.apply(ctx, paid, { kind: 'assign', unit: unitId('inf-1'), planet: null });
    expect(back).toEqual(spec.initial(ctx));
  });

  it('Ende der taktischen Aktion: nur das Siegel, der Hinweis nennt es', () => {
    const ctx = done();
    const spec = TABLE_SPECS.tacticalDone;
    const draft = spec.initial(ctx);
    expect(spec.confirm(ctx, draft)).toBe('endTactical');
    expect(spec.progress(ctx, draft).ready).toBe(true);
    expect(spec.command(ctx, draft)).toEqual({ type: 'EndTacticalAction', issuedBy: ctx.actor });
    expect(spec.hint(ctx)).toBe('tableHintTacticalDone');
  });

  it('Figuren, Gebäude, Bauplätze und der Weltraum haben eigene Schlüssel und Ablagen', () => {
    const { ctx, planet } = landing();
    const refs = [unitTarget('inf-1'), structureTarget('pds'), siteTarget(planet), SPACE];
    for (const ref of refs) expect(parseTargetKey(targetKey(ref))).toEqual(ref);
    expect(targetKey(siteTarget(planet))).not.toBe(targetKey(planetTarget(planet)));
    expect(targetKey(SPACE)).toBe('slot:space');
    const input = {
      game: ctx.game,
      actor: ctx.actor,
      choosing: false,
      specId: 'landing',
      draft: TABLE_SPECS.landing.initial(ctx),
    } as const;
    const unit = unitId('inf-1');
    expect(dropIntent(input, unitTarget(unit), siteTarget(planet))).toEqual({
      kind: 'act',
      action: { kind: 'assign', unit, planet },
    });
    expect(dropIntent(input, unitTarget(unit), SPACE)).toEqual({
      kind: 'act',
      action: { kind: 'assign', unit, planet: null },
    });
    expect(dropIntent(input, structureTarget('pds'), siteTarget(planet))).toEqual({
      kind: 'act',
      action: { kind: 'place', type: 'pds', planet },
    });
    expect(dropIntent(input, unitTarget(unit), planetTarget(planet))).toBeNull();
  });

  it('jeder gebaute Befehl besteht die Probe der Domain', () => {
    const bombard = bombarding();
    const land = landing();
    const cases: readonly [AnySpec, SpecContext, readonly TableAction[]][] = [
      [TABLE_SPECS.bombard, bombard.ctx, []],
      [TABLE_SPECS.bombard, bombard.ctx, [site(bombard.planet)]],
      [TABLE_SPECS.landing, land.ctx, []],
      [TABLE_SPECS.landing, land.ctx, [site(land.planet)]],
      [TABLE_SPECS.landing, land.ctx, [site(land.planet), site(land.planet)]],
      [TABLE_SPECS.tacticalDone, done(), []],
    ];
    for (const [spec, ctx, actions] of cases) {
      const draft = played(spec, ctx, actions);
      expect(probe(ctx, spec.command(ctx, draft)).ok).toBe(true);
      const alternative = spec.alternative?.(ctx, draft)?.command;
      if (alternative !== undefined) expect(probe(ctx, alternative).ok).toBe(true);
    }
  });
});
