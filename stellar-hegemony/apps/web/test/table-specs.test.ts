// @vitest-environment jsdom
import {
  findPlayer,
  type GameCommand,
  type GameState,
  type PlayerId,
  previewCommandTokens,
  strategyCardId,
  type StrategyCardState,
  systemId,
  updatePlayer,
} from '@stellar/domain';
import { SeededRandom } from '@stellar/infrastructure';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useGameStore } from '../src/game-store.ts';
import { useHandStore } from '../src/hand/hand-store.ts';
import { useDraftStore } from '../src/table/draft-store.ts';
import { useTableDecision } from '../src/table/use-table-decision.ts';
import { tryCommand } from '../src/rules-preview.ts';
import { content } from '../src/store.ts';
import { decisionOf } from '../src/table/decision-route.ts';
import {
  type SpecContext,
  TABLE_SPECS,
  type TableAction,
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

/** Ein Entwurf nach einer Folge von Handlungen. */
function played(id: TableSpecId, ctx: SpecContext, actions: readonly TableAction[]): TokenPlan {
  const spec = TABLE_SPECS[id];
  return actions.reduce((draft, action) => spec.apply(ctx, draft, action), spec.initial(ctx));
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
    const spec = TABLE_SPECS.warfare;
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
    expect(useDraftStore.getState().draft).toBeNull();
    expect(fleetOf(useGameStore.getState().game)).toBe((fleetOf(ctx.game) ?? 0) + 3);
  });
});
