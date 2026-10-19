// @vitest-environment jsdom
import {
  domainError,
  findPlayer,
  type GameCommand,
  type GameState,
  type PlayerId,
  previewCommandTokens,
  spendablePlanets,
  strategyCardId,
  type StrategyCardState,
  systemId,
  updatePlayer,
} from '@stellar/domain';
import { SeededRandom } from '@stellar/infrastructure';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useGameStore } from '../src/game-store.ts';
import { useHandStore } from '../src/hand/hand-store.ts';
import { useDraftStore } from '../src/table/draft-store.ts';
import { useTableDecision } from '../src/table/use-table-decision.ts';
import { tryCommand } from '../src/rules-preview.ts';
import { content } from '../src/store.ts';
import { decisionOf } from '../src/table/decision-route.ts';
import { WARFARE_SPEC } from '../src/table/spec-warfare.ts';
import {
  type SpecContext,
  TABLE_SPECS,
  type TableAction,
  type TableDraft,
  type TableSpecId,
  type TokenPlan,
} from '../src/table/table-specs.ts';
import { pickAll, started } from './game-helpers.ts';

const LEADERSHIP = strategyCardId('vanguard');
const WARFARE = strategyCardId('armament');

const activeOf = (game: GameState): PlayerId => game.actionPhase?.active as PlayerId;

function contextOf(game: GameState, actor: PlayerId, chosen = LEADERSHIP): SpecContext {
  const route = decisionOf({ game, actor, waitingOn: null, chosen });
  if (route === null) throw new Error('keine Entscheidung');
  return { game, actor, route };
}

/** Der Entwurf einer Markerverteilung; jede andere Art ist hier ein Fehler. */
function tokensOf(draft: TableDraft | null | undefined): TokenPlan {
  if (draft?.kind !== 'tokens') throw new Error('keine Markerverteilung');
  return draft;
}

/** Ein Entwurf nach einer Folge von Handlungen. */
function played(id: TableSpecId, ctx: SpecContext, actions: readonly TableAction[]): TokenPlan {
  const spec = TABLE_SPECS[id];
  const start: TableDraft = spec.initial(ctx);
  return tokensOf(actions.reduce((draft, action) => spec.apply(ctx, draft, action), start));
}

const toFleet = (count: number): TableAction[] =>
  Array.from({ length: count }, () => ({ kind: 'move', from: 'loose', to: 'fleet' }) as const);

function tokenStep(): SpecContext {
  const game = pickAll(started());
  const order = game.players.map((player) => player.id);
  const statusPhase = { step: 'tokens', order, waiting: order, scored: {} } as const;
  const status: GameState = { ...game, phase: 'status', actionPhase: null, statusPhase };
  return contextOf(status, order[0] as PlayerId);
}

const rich = (game: GameState, player: PlayerId): GameState =>
  updatePlayer(game, player, (p) => ({ ...p, tradeGoods: 3 }));

function leadershipPrimary(): SpecContext {
  const game = pickAll(started());
  return contextOf(rich(game, activeOf(game)), activeOf(game));
}

/** Nach der Primärfähigkeit der Führung ist der Nächste mit der Sekundärfähigkeit dran. */
function leadershipSecondary(): SpecContext {
  const ctx = leadershipPrimary();
  const done = tryCommand(
    ctx.game,
    TABLE_SPECS.leadership.command(ctx, played('leadership', ctx, toFleet(3))),
  );
  if (!done.ok) throw new Error(done.error.code);
  const next = done.value.actionPhase?.secondary?.awaiting[0] as PlayerId;
  return contextOf(rich(done.value, next), next);
}

/** Der Aktive hält die Kriegsführung; auf Wunsch liegt ein eigener Marker im ersten System. */
function warfare(withToken: boolean): SpecContext & { readonly marked: string } {
  const game = pickAll(started());
  const actor = activeOf(game);
  const card = game.strategyCards[WARFARE] as StrategyCardState;
  const marked = Object.keys(game.systems)[0] as string;
  const system = game.systems[marked] as GameState['systems'][string];
  const systems = withToken
    ? { ...game.systems, [marked]: { ...system, commandTokens: [actor] } }
    : game.systems;
  const strategyCards = { ...game.strategyCards, [WARFARE]: { ...card, holder: actor } };
  return { ...contextOf({ ...game, systems, strategyCards }, actor, WARFARE), marked };
}

const probe = (ctx: SpecContext, command: GameCommand) => tryCommand(ctx.game, command).ok;

describe('Tischentscheidungen der Kommandomarker', () => {
  it('Markerverteilung sendet AllocateCommandTokens mit den geplanten Pools', () => {
    const ctx = tokenStep();
    const pools = findPlayer(ctx.game, ctx.actor)?.commandPools;
    const draft = played('tokens', ctx, toFleet(2));
    expect(TABLE_SPECS.tokens.command(ctx, draft)).toEqual({
      type: 'AllocateCommandTokens',
      issuedBy: ctx.actor,
      pools: { ...pools, fleet: (pools?.fleet ?? 0) + 2 },
    });
    expect(TABLE_SPECS.tokens.confirm(ctx, draft)).toBe('confirm');
  });

  it('bereit erst bei leerer Schale', () => {
    const ctx = tokenStep();
    const spec = TABLE_SPECS.tokens;
    expect(spec.progress(ctx, played('tokens', ctx, []))).toEqual({
      done: 0,
      needed: 2,
      ready: false,
    });
    expect(spec.progress(ctx, played('tokens', ctx, toFleet(1)))).toEqual({
      done: 1,
      needed: 2,
      ready: false,
    });
    expect(spec.progress(ctx, played('tokens', ctx, toFleet(2)))).toEqual({
      done: 2,
      needed: 2,
      ready: true,
    });
    expect(spec.targets(ctx, played('tokens', ctx, [])).get('pool:tactic')).toBe('legal');
    expect(spec.targets(ctx, played('tokens', ctx, toFleet(2))).size).toBe(0);
  });

  it('Handelswaren erhöhen die neuen Marker laut Domain und setzen die Verteilung zurück', () => {
    const ctx = leadershipPrimary();
    const more: TableAction = { kind: 'tradeGoods', delta: 1 };
    const card = content.strategyCards.find((candidate) => candidate.id === LEADERSHIP);
    if (card === undefined) throw new Error('Führung fehlt');
    const context = { random: new SeededRandom(0), now: 0, content };
    const influence = { planets: [], tradeGoods: 3 };
    const input = { state: ctx.game, player: ctx.actor, card, context, influence };
    const expected = previewCommandTokens(input, 'primary');
    const draft = played('leadership', ctx, [...toFleet(1), more, more, more, more]);
    expect(draft.tradeGoods).toBe(3);
    expect(expected.ok && draft.pools.loose === expected.value).toBe(true);
    expect(draft.pools.loose).toBe(4);
    expect(draft.pools.pools).toEqual(findPlayer(ctx.game, ctx.actor)?.commandPools);
    const less = played('leadership', ctx, [{ kind: 'tradeGoods', delta: -1 }]);
    expect(less.tradeGoods).toBe(0);
  });

  it('Führung: ein Einflussplanet bringt laut Domain weitere Marker und setzt die Verteilung zurück', () => {
    const ctx = leadershipPrimary();
    const card = content.strategyCards.find((candidate) => candidate.id === LEADERSHIP);
    if (card === undefined) throw new Error('Führung fehlt');
    const [planet] = spendablePlanets(ctx.game, content.tiles, ctx.actor, 'influence');
    if (planet === undefined) throw new Error('kein Einflussplanet');
    const tap: TableAction = { kind: 'planet', planet: planet.planet };
    const more: TableAction = { kind: 'tradeGoods', delta: 1 };
    const context = { random: new SeededRandom(0), now: 0, content };
    const influence = { planets: [planet.planet], tradeGoods: 3 };
    const input = { state: ctx.game, player: ctx.actor, card, context, influence };
    const expected = previewCommandTokens(input, 'primary');
    const draft = played('leadership', ctx, [more, more, more, ...toFleet(1), tap]);
    expect(draft.planets).toEqual([planet.planet]);
    expect(expected.ok && draft.pools.loose === expected.value).toBe(true);
    expect(draft.pools.pools).toEqual(findPlayer(ctx.game, ctx.actor)?.commandPools);
    const side = TABLE_SPECS.leadership.planets?.(ctx, draft);
    expect(side).toMatchObject({ mode: 'pay', currency: 'influence', tradeGoods: 3 });
    expect(TABLE_SPECS.leadership.targets(ctx, draft).get(`planet:${planet.planet}`)).toBe(
      'chosen',
    );
    expect(played('leadership', ctx, [tap, tap]).planets).toEqual([]);
    const tapped = played('leadership', ctx, [tap]);
    const placed = played('leadership', ctx, [tap, ...toFleet(tapped.pools.loose)]);
    expect(TABLE_SPECS.leadership.progress(ctx, placed).ready).toBe(true);
    expect(probe(ctx, TABLE_SPECS.leadership.command(ctx, placed))).toBe(true);
    expect(TABLE_SPECS.leadership.command(ctx, placed)).toMatchObject({
      choice: { influence: { planets: [planet.planet], tradeGoods: 0 } },
    });
  });

  it('Führung sendet nur die neu gelegten Marker', () => {
    const ctx = leadershipPrimary();
    const draft = played('leadership', ctx, toFleet(3));
    expect(TABLE_SPECS.leadership.progress(ctx, draft)).toEqual({
      done: 3,
      needed: 3,
      ready: true,
    });
    expect(TABLE_SPECS.leadership.command(ctx, draft)).toEqual({
      type: 'PerformStrategicAction',
      issuedBy: ctx.actor,
      card: LEADERSHIP,
      choice: {
        mechanic: 'commandTokens',
        influence: { planets: [], tradeGoods: 0 },
        allocation: { tactic: 0, fleet: 3, strategy: 0 },
      },
    });
    const secondary = leadershipSecondary();
    const answer = TABLE_SPECS.leadership.command(secondary, played('leadership', secondary, []));
    expect(answer.type).toBe('ResolveSecondary');
  });

  it('Kriegsführung: ein Klick auf ein System mit eigenem Marker legt ihn lose in die Schale', () => {
    const ctx = warfare(true);
    const spec = WARFARE_SPEC;
    const start = spec.initial(ctx);
    expect(spec.progress(ctx, start).ready).toBe(false);
    expect(spec.targets(ctx, start).get(`system:${ctx.marked}`)).toBe('legal');
    const other = Object.keys(ctx.game.systems)[1] as string;
    expect(spec.apply(ctx, start, { kind: 'system', system: systemId(other) })).toBe(start);
    const lifted = spec.apply(ctx, start, { kind: 'system', system: systemId(ctx.marked) });
    expect(lifted.system).toBe(ctx.marked);
    expect(lifted.pools.loose).toBe(1);
    expect(lifted.pools.source).toBe('board');
    expect(spec.targets(ctx, lifted).get(`system:${ctx.marked}`)).toBe('chosen');
    const placed = spec.apply(ctx, lifted, { kind: 'move', from: 'loose', to: 'strategy' });
    expect(spec.progress(ctx, placed)).toEqual({ done: 1, needed: 1, ready: true });
    expect(spec.confirm(ctx, placed)).toBe('confirm');
  });

  it('Kriegsführung: dasselbe System noch einmal ändert nichts, ein anderes behält die gelegte Verteilung', () => {
    const base = warfare(true);
    const second = Object.keys(base.game.systems)[1] as string;
    const system = base.game.systems[second] as GameState['systems'][string];
    const systems = { ...base.game.systems, [second]: { ...system, commandTokens: [base.actor] } };
    const ctx = { ...base, game: { ...base.game, systems } };
    const spec = WARFARE_SPEC;
    const pick = (draft: TokenPlan, id: string) =>
      spec.apply(ctx, draft, { kind: 'system', system: systemId(id) });
    const lifted = pick(spec.initial(ctx), base.marked);
    const placed = spec.apply(ctx, lifted, { kind: 'move', from: 'loose', to: 'fleet' });
    expect(pick(placed, base.marked)).toBe(placed);
    const switched = pick(placed, second);
    expect(switched.system).toBe(second);
    expect(switched.pools).toEqual(placed.pools);
    expect(spec.progress(ctx, switched).ready).toBe(true);
  });

  it('Kriegsführung ohne Marker auf der Karte sendet system null', () => {
    const ctx = warfare(false);
    const spec = TABLE_SPECS.warfare;
    const draft = spec.apply(ctx, spec.initial(ctx), { kind: 'move', from: 'tactic', to: 'fleet' });
    expect(spec.progress(ctx, draft).ready).toBe(true);
    expect(spec.confirm(ctx, draft)).toBe('withoutToken');
    expect(spec.command(ctx, draft)).toMatchObject({
      type: 'PerformStrategicAction',
      card: WARFARE,
      choice: { mechanic: 'warfare', system: null, production: null },
    });
  });

  it('jeder gebaute Befehl besteht die Probe der Domain', () => {
    const tokens = tokenStep();
    const leader = leadershipPrimary();
    const follower = leadershipSecondary();
    const marked = warfare(true);
    const unmarked = warfare(false);
    const lifted = played('warfare', marked, [
      { kind: 'system', system: systemId(marked.marked) },
      { kind: 'move', from: 'loose', to: 'fleet' },
    ]);
    const more: TableAction = { kind: 'tradeGoods', delta: 1 };
    expect(
      probe(tokens, TABLE_SPECS.tokens.command(tokens, played('tokens', tokens, toFleet(2)))),
    ).toBe(true);
    expect(
      probe(
        leader,
        TABLE_SPECS.leadership.command(leader, played('leadership', leader, toFleet(3))),
      ),
    ).toBe(true);
    const followed = played('leadership', follower, [more, more, more, ...toFleet(1)]);
    expect(probe(follower, TABLE_SPECS.leadership.command(follower, followed))).toBe(true);
    expect(probe(marked, TABLE_SPECS.warfare.command(marked, lifted))).toBe(true);
    expect(
      probe(unmarked, TABLE_SPECS.warfare.command(unmarked, played('warfare', unmarked, []))),
    ).toBe(true);
  });

  it('der Entwurf entsteht beim Zeichnen, lebt im Store und endet mit dem Siegel', () => {
    const ctx = leadershipPrimary();
    const fleetOf = (game: GameState | null) =>
      game === null ? -1 : findPlayer(game, ctx.actor)?.commandPools.fleet;
    useGameStore.setState({ game: ctx.game, me: ctx.actor });
    useHandStore.getState().choose({ player: ctx.actor, card: LEADERSHIP });
    useDraftStore.getState().clear();
    const { result } = renderHook(() => useTableDecision(useGameStore((state) => state.game)));
    const decision = () => {
      if (result.current === null) throw new Error('keine Entscheidung');
      return result.current;
    };
    expect(decision()).toMatchObject({ specId: 'leadership', draft: { pools: { loose: 3 } } });
    expect(decision().alternative?.label).toBe('cancel');
    expect(useDraftStore.getState().key).toBeNull();
    for (const action of toFleet(3)) act(() => decision().act(action));
    expect(useDraftStore.getState().key).toBe(`${decision().route.key}@${ctx.game.version}`);
    expect(decision().progress?.ready).toBe(true);
    act(() => decision().confirm());
    expect(useHandStore.getState().chosen).toBeNull();
    // Der Entwurf bleibt liegen; der neue Spielstand hat ihn über den Schlüssel abgelöst.
    expect(useDraftStore.getState().sent).toBe(useDraftStore.getState().key);
    expect(decision().route.kind).not.toBe('primary');
    expect(fleetOf(useGameStore.getState().game)).toBe((fleetOf(ctx.game) ?? 0) + 3);
  });

  it('nach dem Siegel bleibt der Entwurf gesperrt liegen, bis der Server antwortet; eine Ablehnung gibt ihn frei', () => {
    const ctx = leadershipPrimary();
    const sent: GameCommand[] = [];
    const before = useGameStore.getState().remote;
    const remote = { command: (command: GameCommand) => void sent.push(command), undo: vi.fn() };
    useGameStore.setState({ game: ctx.game, me: ctx.actor, error: null, remote });
    useHandStore.getState().choose({ player: ctx.actor, card: LEADERSHIP });
    useDraftStore.getState().clear();
    const { result } = renderHook(() => useTableDecision(useGameStore((state) => state.game)));
    const decision = () => {
      if (result.current === null) throw new Error('keine Entscheidung');
      return result.current;
    };
    for (const action of toFleet(3)) act(() => decision().act(action));
    const sealed = decision();
    act(() => {
      sealed.confirm();
      sealed.confirm();
    });
    expect(sent).toHaveLength(1);
    act(() => useHandStore.getState().choose({ player: ctx.actor, card: LEADERSHIP }));
    expect(tokensOf(decision().draft).pools.pools.fleet).toBe((fleetOf(ctx) ?? 0) + 3);
    expect(decision().progress?.ready).toBe(false);
    act(() => useGameStore.getState().setError(domainError('rules.denied', 'abgelehnt')));
    expect(decision().progress?.ready).toBe(true);
    useGameStore.setState({ remote: before, error: null });
  });
});

const fleetOf = (ctx: SpecContext) => findPlayer(ctx.game, ctx.actor)?.commandPools.fleet;
