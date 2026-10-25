import {
  findPlayer,
  type GameCommand,
  type GameState,
  NO_PAYMENT,
  type PlanetId,
  type PlayerId,
  researchOptions,
  specialtyPlanets,
  strategyCardId,
  type StrategyCardState,
  type SystemId,
  type TechnologyId,
  unitTypeId,
  updatePlayer,
} from '@stellar/domain';
import { describe, expect, it } from 'vitest';
import { homeSystemOf } from '../src/card-view.ts';
import { tryCommand } from '../src/rules-preview.ts';
import { content } from '../src/store.ts';
import { decisionOf } from '../src/table/decision-route.ts';
import { shipyardFor } from '../src/table/shipyard.ts';
import { researchSpreadOf } from '../src/table/spec-research.ts';
import {
  type AnySpec,
  type SpecContext,
  TABLE_SPECS,
  type TableAction,
  type TableDraft,
} from '../src/table/table-specs.ts';
import {
  DOCK,
  siteTarget,
  systemTarget,
  type TargetRef,
  targetKey,
  yardPiece,
} from '../src/table/target-ref.ts';
import type { TableDecision } from '../src/table/use-table-decision.ts';
import { pickAll, started } from './game-helpers.ts';

const ARMAMENT = strategyCardId('armament');
const RESEARCH = strategyCardId('research');
const INFANTRY = unitTypeId('infantry');
const CRUISER = unitTypeId('cruiser');

const activeOf = (game: GameState): PlayerId => game.actionPhase?.active as PlayerId;

function contextOf(game: GameState, actor: PlayerId, chosen = RESEARCH): SpecContext {
  const route = decisionOf({ game, actor, waitingOn: null, chosen });
  if (route === null) throw new Error('keine Entscheidung');
  return { game, actor, route };
}

const rich = (game: GameState, player: PlayerId, tradeGoods = 10): GameState =>
  updatePlayer(game, player, (p) => ({ ...p, tradeGoods }));

const withFleetPool = (game: GameState, player: PlayerId, fleet: number): GameState =>
  updatePlayer(game, player, (p) => ({ ...p, commandPools: { ...p.commandPools, fleet } }));

const homeOf = (game: GameState, player: PlayerId): SystemId =>
  homeSystemOf(game, player, content) as SystemId;

/** Das Heimatsystem ohne eigene Planeteneinheiten: keine Raumwerft, keine Produktion. */
function withoutDock(game: GameState, player: PlayerId): GameState {
  const ids = game.systems[homeOf(game, player)]?.planetIds ?? [];
  const planets = Object.fromEntries(
    ids.flatMap((id) => {
      const planet = game.planets[id];
      if (planet === undefined) return [];
      return [[id, { ...planet, units: planet.units.filter((unit) => unit.owner !== player) }]];
    }),
  );
  return { ...game, planets: { ...game.planets, ...planets } };
}

/** Der Aktive steht im Schritt Produktion seiner taktischen Aktion im Heimatsystem. */
function producing(tradeGoods = 10): SpecContext {
  const state = pickAll(started());
  const actor = activeOf(state);
  const system = homeOf(state, actor);
  const tactical = {
    system,
    step: 'production',
    pendingHits: [],
    combat: null,
    windows: [],
    bonuses: [],
  } as const;
  const turn = state.actionPhase as NonNullable<GameState['actionPhase']>;
  const game = { ...rich(state, actor, tradeGoods), actionPhase: { ...turn, tactical } };
  return contextOf(game, actor);
}

/** Ein anderer Spieler folgt der Karte des Aktiven (Sekundärfähigkeit). */
function following(card: typeof ARMAMENT, tradeGoods = 10): SpecContext {
  const state = pickAll(started());
  const turn = state.actionPhase as NonNullable<GameState['actionPhase']>;
  const actor = state.players.find((player) => player.id !== turn.active)?.id as PlayerId;
  const secondary = { card, awaiting: [actor], free: [] };
  return contextOf(
    { ...rich(state, actor, tradeGoods), actionPhase: { ...turn, secondary } },
    actor,
  );
}

/** Der Aktive hält die Technologie und wählt ihre strategische Aktion. */
function researching(tradeGoods = 10, change = (game: GameState) => game): SpecContext {
  const state = pickAll(started());
  const actor = activeOf(state);
  const held = { ...(state.strategyCards[RESEARCH] as StrategyCardState), holder: actor };
  const game = {
    ...rich(state, actor, tradeGoods),
    strategyCards: { ...state.strategyCards, [RESEARCH]: held },
  };
  return contextOf(change(game), actor);
}

const played = (spec: AnySpec, ctx: SpecContext, actions: readonly TableAction[]): TableDraft =>
  actions.reduce((draft, action) => spec.apply(ctx, draft, action), spec.initial(ctx));

const orderOf = (type: typeof INFANTRY, planet: PlanetId | null = null): TableAction => ({
  kind: 'order',
  type,
  delta: 1,
  planet,
});

const coins = (count: number): TableAction[] =>
  Array.from({ length: count }, () => ({ kind: 'tradeGoods', delta: 1 }) as const);

const probe = (ctx: SpecContext, command: GameCommand) => tryCommand(ctx.game, command);

const yardOf = (ctx: SpecContext, draft: TableDraft) =>
  draft.kind === 'production' ? shipyardFor(ctx.game, ctx.actor, draft) : null;

/** Die ersten offenen Technologien ohne fehlende Voraussetzung. */
const openTechs = (ctx: SpecContext): readonly TechnologyId[] =>
  researchOptions(ctx.game, ctx.actor, content, { technologies: [], specialties: [] })
    .filter((option) => option.missing.length === 0)
    .map((option) => option.technology.id);

const pick = (technology: TechnologyId | undefined): TableAction => ({
  kind: 'technology',
  technology: technology as TechnologyId,
});

const legalOf = (spec: AnySpec, ctx: SpecContext, draft: TableDraft, piece: TargetRef) =>
  spec.legal?.(ctx, draft, piece) ?? new Set<string>();

const groundPlanetsOf = (ctx: SpecContext, draft: TableDraft): readonly PlanetId[] =>
  yardOf(ctx, draft)?.quote.groundPlanets ?? [];

/** Ein Planet mit Spezialisierung wird eigener, bereiter Planet des Handelnden. */
function withSpecialtyWorld(base: SpecContext): { ctx: SpecContext; world: PlanetId } {
  const special = (id: PlanetId) =>
    content.tiles
      .all()
      .some((tile) => tile.planets.some((p) => p.id === id && p.technologySpecialty !== undefined));
  const world = Object.values(base.game.planets).find((planet) => special(planet.id));
  if (world === undefined) throw new Error('kein Planet mit Spezialisierung');
  const held = { ...world, controller: base.actor, exhausted: false };
  const planets = { ...base.game.planets, [world.id]: held };
  return { ctx: { ...base, game: { ...base.game, planets } }, world: world.id };
}

const decisionOfDraft = (ctx: SpecContext, draft: TableDraft): TableDecision =>
  ({ route: ctx.route, draft }) as TableDecision;

describe('Werft am Tisch: taktische Produktion', () => {
  it('Werft: ohne Bestellung heißt das Siegel Ohne Produktion weiter, das System ist gewählt', () => {
    const ctx = producing();
    const spec = TABLE_SPECS.production;
    const draft = spec.initial(ctx);
    const system = homeOf(ctx.game, ctx.actor);
    expect(draft).toMatchObject({ kind: 'production', system, orders: {}, groundPlanet: null });
    expect(spec.hint(ctx)).toBe('tableHintProduction');
    expect(spec.confirm(ctx, draft)).toBe('skipProduction');
    expect(spec.alternative?.(ctx, draft)).toBeNull();
    expect(spec.planets?.(ctx, draft)).toBeNull();
    expect(spec.progress(ctx, draft).ready).toBe(true);
    expect([...spec.targets(ctx, draft).entries()]).toEqual([
      [targetKey(systemTarget(system)), 'chosen'],
    ]);
    expect(spec.command(ctx, draft)).toEqual({
      type: 'ProduceUnits',
      issuedBy: ctx.actor,
      orders: [],
      payment: NO_PAYMENT,
      groundPlanet: null,
    });
  });

  it('Werft: je baubarer Art ein Stück; Bodentruppen dürfen auch auf Planeten mit Produktion', () => {
    const ctx = producing();
    const spec = TABLE_SPECS.production;
    const draft = spec.initial(ctx);
    const system = homeOf(ctx.game, ctx.actor);
    const pieces = spec.pieces?.(ctx, draft);
    expect(pieces?.map((piece) => piece.ref)).toContainEqual(yardPiece(INFANTRY));
    expect(pieces?.every((piece) => piece.owner === ctx.actor && piece.at === null)).toBe(true);
    const ground = groundPlanetsOf(ctx, draft);
    expect(ground.length).toBeGreaterThan(0);
    expect(legalOf(spec, ctx, draft, yardPiece(INFANTRY))).toEqual(
      new Set([
        targetKey(DOCK),
        targetKey(systemTarget(system)),
        ...ground.map((planet) => targetKey(siteTarget(planet))),
      ]),
    );
    const ships = legalOf(spec, ctx, draft, yardPiece(CRUISER));
    expect([...ships].some((key) => key.startsWith('site:'))).toBe(false);
    expect(legalOf(spec, ctx, draft, systemTarget(system)).size).toBe(0);
  });

  it('Werft: zwei Infanterie kosten 1 und sind erst bezahlt bereit; ohne Produktion bleibt der Ausweg', () => {
    const ctx = producing();
    const spec = TABLE_SPECS.production;
    const draft = played(spec, ctx, [orderOf(INFANTRY), orderOf(INFANTRY)]);
    expect(spec.confirm(ctx, draft)).toBe('produce');
    expect(spec.progress(ctx, draft)).toMatchObject({ done: 2, ready: false });
    expect(spec.planets?.(ctx, draft)).toMatchObject({
      mode: 'pay',
      currency: 'resources',
      required: 1,
    });
    expect(spec.alternative?.(ctx, draft)).toEqual({
      label: 'skipProduction',
      command: {
        type: 'ProduceUnits',
        issuedBy: ctx.actor,
        orders: [],
        payment: NO_PAYMENT,
        groundPlanet: null,
      },
    });
    const paid = played(spec, ctx, [orderOf(INFANTRY), orderOf(INFANTRY), ...coins(1)]);
    expect(spec.progress(ctx, paid).ready).toBe(true);
    const ground = yardOf(ctx, paid)?.groundPlanet;
    expect(spec.command(ctx, paid)).toMatchObject({
      orders: [{ type: INFANTRY, count: 2 }],
      payment: { planets: [], tradeGoods: 1 },
      groundPlanet: ground,
    });
  });

  it('Werft: eine Bodentruppe auf einem Planeten ohne Produktion ändert nichts, ein Bauplatz schon', () => {
    const ctx = producing();
    const spec = TABLE_SPECS.production;
    const start = spec.initial(ctx);
    const ground = yardOf(ctx, start)?.quote.groundPlanets[0] as PlanetId;
    const foreign = Object.values(ctx.game.planets).find(
      (planet) => planet.controller !== ctx.actor,
    )?.id as PlanetId;
    expect(spec.apply(ctx, start, orderOf(INFANTRY, foreign))).toBe(start);
    const placed = spec.apply(ctx, start, orderOf(INFANTRY, ground));
    expect(placed).toMatchObject({ orders: { infantry: 1 }, groundPlanet: ground });
    expect(spec.apply(ctx, start, { kind: 'site', planet: ground })).toMatchObject({
      groundPlanet: ground,
    });
  });

  it('Werft: ohne Handelswaren und Planeten bleibt das Siegel zu', () => {
    const base = producing(0);
    const planets = Object.fromEntries(
      Object.entries(base.game.planets).map(([id, planet]) => [
        id,
        planet.controller === base.actor ? { ...planet, exhausted: true } : planet,
      ]),
    );
    const ctx = { ...base, game: { ...base.game, planets } };
    const spec = TABLE_SPECS.production;
    const draft = played(spec, ctx, [orderOf(CRUISER), ...coins(3)]);
    expect(spec.progress(ctx, draft).ready).toBe(false);
  });

  it('Werft: ein Schiff über dem Flottenlimit lässt das Siegel zu, Bodentruppen nicht', () => {
    const base = producing();
    const spec = TABLE_SPECS.production;
    const infantry = [orderOf(INFANTRY), orderOf(INFANTRY), ...coins(1)];
    const withFleet = (fleet: number): SpecContext => ({
      ...base,
      game: withFleetPool(base.game, base.actor, fleet),
    });
    // Das knappste Flottenlimit, bei dem die Domain Bodentruppen noch annimmt: voll besetzt.
    const ctx = [0, 1, 2, 3, 4, 5, 6, 7, 8]
      .map(withFleet)
      .find((tight) => probe(tight, spec.command(tight, played(spec, tight, infantry))).ok);
    if (ctx === undefined) throw new Error('kein passendes Flottenlimit');
    expect(spec.progress(ctx, played(spec, ctx, infantry)).ready).toBe(true);
    const ship = played(spec, ctx, [orderOf(CRUISER), ...coins(2)]);
    expect(probe(ctx, spec.command(ctx, ship)).ok).toBe(false);
    expect(spec.progress(ctx, ship).ready).toBe(false);
  });
});

describe('Werft am Tisch: Kriegsführung sekundär', () => {
  it('Kriegsführung sekundär: ohne Bau abschließen sendet eine leere Produktion im Heimatsystem', () => {
    const ctx = following(ARMAMENT);
    const spec = TABLE_SPECS.warfareSecondary;
    const draft = spec.initial(ctx);
    expect(draft).toMatchObject({ kind: 'production', system: homeOf(ctx.game, ctx.actor) });
    expect(spec.hint(ctx)).toBe('tableHintWarfareSecondary');
    expect(spec.confirm(ctx, draft)).toBe('finishWithoutBuilding');
    expect(spec.alternative?.(ctx, draft)).toBeNull();
    const pools = findPlayer(ctx.game, ctx.actor)?.commandPools;
    expect(spec.command(ctx, draft)).toEqual({
      type: 'ResolveSecondary',
      issuedBy: ctx.actor,
      choice: {
        mechanic: 'warfare',
        system: null,
        pools,
        production: { orders: [], payment: NO_PAYMENT, groundPlanet: null },
      },
    });
  });

  it('Kriegsführung sekundär: ohne Produktionseinheit bleibt auch das Siegel ohne Bau zu', () => {
    const base = following(ARMAMENT);
    const spec = TABLE_SPECS.warfareSecondary;
    expect(spec.progress(base, spec.initial(base)).ready).toBe(true);
    const ctx = { ...base, game: withoutDock(base.game, base.actor) };
    expect(spec.progress(ctx, spec.initial(ctx)).ready).toBe(false);
  });

  it('Kriegsführung sekundär: mit Bestellung heißt das Siegel Produzieren, Ablehnen bleibt', () => {
    const base = following(ARMAMENT);
    const ctx = { ...base, game: withFleetPool(base.game, base.actor, 8) };
    const spec = TABLE_SPECS.warfareSecondary;
    const draft = played(spec, ctx, [orderOf(CRUISER), ...coins(2)]);
    expect(spec.confirm(ctx, draft)).toBe('produce');
    expect(spec.alternative?.(ctx, draft)).toBeNull();
    expect(spec.progress(ctx, draft).ready).toBe(true);
  });
});

describe('Forschungsauslage am Tisch', () => {
  it('Technologie primär: die erste ist kostenlos, die zweite kostet; mehr als zwei passen nicht', () => {
    const ctx = researching();
    const spec = TABLE_SPECS.technology;
    const [first, second, third] = openTechs(ctx);
    expect(spec.hint(ctx)).toBe('tableHintResearch');
    expect(spec.confirm(ctx, spec.initial(ctx))).toBe('research');
    expect(spec.progress(ctx, spec.initial(ctx))).toEqual({ done: 0, needed: 2, ready: false });
    const one = played(spec, ctx, [pick(first)]);
    expect(spec.planets?.(ctx, one)).toBeNull();
    expect(spec.progress(ctx, one).ready).toBe(true);
    const two = played(spec, ctx, [pick(first), pick(second), pick(third)]);
    expect(two.kind === 'research' && two.technologies).toEqual([first, second]);
    expect(spec.planets?.(ctx, two)).toMatchObject({ mode: 'pay', required: 6 });
    expect(spec.progress(ctx, two).ready).toBe(false);
    const paid = played(spec, ctx, [pick(first), pick(second), ...coins(6)]);
    expect(spec.progress(ctx, paid).ready).toBe(true);
  });

  it('Technologie: gesperrte Karten lassen sich nicht wählen, gewählte zurücklegen', () => {
    const ctx = researching();
    const spec = TABLE_SPECS.technology;
    const locked = researchOptions(ctx.game, ctx.actor, content, {
      technologies: [],
      specialties: [],
    })
      .filter((option) => option.missing.length > 1)
      .map((option) => option.technology.id)[0];
    const start = spec.initial(ctx);
    expect(spec.apply(ctx, start, pick(locked))).toBe(start);
    const [first] = openTechs(ctx);
    const chosen = spec.apply(ctx, start, pick(first));
    expect(spec.apply(ctx, chosen, pick(first))).toEqual(start);
  });

  it('Technologie sekundär: genau eine, sie kostet und ist erst bezahlt bereit', () => {
    const ctx = following(RESEARCH);
    const spec = TABLE_SPECS.technology;
    const [first, second] = openTechs(ctx);
    const one = played(spec, ctx, [pick(first), pick(second)]);
    expect(one.kind === 'research' && one.technologies).toEqual([first]);
    expect(spec.planets?.(ctx, one)).toMatchObject({ required: 4 });
    expect(spec.progress(ctx, one)).toMatchObject({ done: 1, needed: 1, ready: false });
    const paid = played(spec, ctx, [pick(first), ...coins(4)]);
    expect(spec.progress(ctx, paid).ready).toBe(true);
  });

  it('Forschungsauslage: Spalten je Farbe, gewählte, gesperrte und volle Karten', () => {
    const ctx = following(RESEARCH);
    const spec = TABLE_SPECS.technology;
    const [first] = openTechs(ctx);
    const draft = played(spec, ctx, [pick(first)]);
    const spread = researchSpreadOf(ctx.game, decisionOfDraft(ctx, draft));
    expect(spread?.columns.map((column) => column.color)).toEqual([
      'biotic',
      'propulsion',
      'cybernetic',
      'warfare',
      null,
    ]);
    const cards = spread?.columns.flatMap((column) => column.cards) ?? [];
    expect(cards.find((card) => card.technology.id === first)?.state).toBe('chosen');
    const states = new Set(cards.map((card) => card.state));
    expect(states.has('open')).toBe(false);
    expect(states.has('full')).toBe(true);
    expect(spread).toMatchObject({ count: 1, max: 1, required: 4, unusedSpecialty: false });
    expect(researchSpreadOf(ctx.game, null)).toBeNull();
  });

  it('Forschung: eine genutzte Spezialisierung verlässt die Bezahlung und wird nicht angeboten', () => {
    const { ctx, world } = withSpecialtyWorld(researching());
    const usable = specialtyPlanets(ctx.game, ctx.actor, content).map((entry) => entry.planet);
    expect(usable).toContain(world);
    const spec = TABLE_SPECS.technology;
    const [first, second] = openTechs(ctx);
    const paying = played(spec, ctx, [
      pick(first),
      pick(second),
      { kind: 'planet', planet: world },
    ]);
    expect(paying.kind === 'research' && paying.payment.planets).toEqual([world]);
    const used = spec.apply(ctx, paying, { kind: 'specialty', planet: world });
    expect(used.kind === 'research' && used.payment.planets).toEqual([]);
    expect(spec.planets?.(ctx, used)?.offered).not.toContain(world);
    const spread = researchSpreadOf(ctx.game, decisionOfDraft(ctx, used));
    const entry = spread?.specialties.find((specialty) => specialty.planet === world);
    expect(entry?.chosen).toBe(true);
    expect(spread?.unusedSpecialty).toBe(true);
  });
});

describe('Probe der Domain', () => {
  it('jeder gebaute Befehl besteht die Probe der Domain', () => {
    const tactical = producing();
    const production = TABLE_SPECS.production;
    const built = played(production, tactical, [orderOf(INFANTRY), orderOf(INFANTRY), ...coins(1)]);
    expect(probe(tactical, production.command(tactical, built)).ok).toBe(true);
    expect(probe(tactical, production.command(tactical, production.initial(tactical))).ok).toBe(
      true,
    );

    const warfare = following(ARMAMENT);
    const yard = TABLE_SPECS.warfareSecondary;
    const troops = played(yard, warfare, [orderOf(INFANTRY), ...coins(1)]);
    expect(probe(warfare, yard.command(warfare, troops)).ok).toBe(true);
    expect(probe(warfare, yard.command(warfare, yard.initial(warfare))).ok).toBe(true);

    const primary = researching();
    const research = TABLE_SPECS.technology;
    const [first, second] = openTechs(primary);
    const free = played(research, primary, [pick(first)]);
    expect(probe(primary, research.command(primary, free)).ok).toBe(true);
    const two = played(research, primary, [pick(first), pick(second), ...coins(6)]);
    expect(probe(primary, research.command(primary, two)).ok).toBe(true);

    const secondary = following(RESEARCH);
    const [own] = openTechs(secondary);
    const one = played(research, secondary, [pick(own), ...coins(4)]);
    expect(probe(secondary, research.command(secondary, one)).ok).toBe(true);
  });
});
