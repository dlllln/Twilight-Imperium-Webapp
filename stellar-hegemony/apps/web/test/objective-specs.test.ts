import {
  type GameCommand,
  type GameState,
  objectiveId,
  type PlanetId,
  type PlayerId,
  spendablePlanets,
  strategyCardId,
  type StrategyCardState,
  updatePlayer,
} from '@stellar/domain';
import { describe, expect, it } from 'vitest';
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
import { pickAll, started } from './game-helpers.ts';

const CROWN = strategyCardId('crown');
const EMBASSY = strategyCardId('embassy');
const GOODS = objectiveId('merchant-reserve');
const WAR_CHEST = objectiveId('war-chest');
const FAR = objectiveId('settled-reach');

const activeOf = (game: GameState): PlayerId => game.actionPhase?.active as PlayerId;

function contextOf(game: GameState, actor: PlayerId, chosen = CROWN): SpecContext {
  const route = decisionOf({ game, actor, waitingOn: null, chosen });
  if (route === null) throw new Error('keine Entscheidung');
  return { game, actor, route };
}

/** Aufgedeckte öffentliche Aufträge; der Spieler hat genug Handelswaren für jede Ausgabe. */
function withPublic(game: GameState, player: PlayerId): GameState {
  const slot = (id: typeof GOODS) => ({ id, stage: 1, revealed: true });
  const objectives = { ...game.objectives, public: [GOODS, WAR_CHEST, FAR].map(slot) };
  return updatePlayer({ ...game, objectives }, player, (p) => ({ ...p, tradeGoods: 10 }));
}

function scoring(): SpecContext {
  const game = pickAll(started());
  const order = game.players.map((player) => player.id);
  const statusPhase = { step: 'scoring', order, waiting: order, scored: {} } as const;
  const actor = order[0] as PlayerId;
  return contextOf(
    withPublic({ ...game, phase: 'status', actionPhase: null, statusPhase }, actor),
    actor,
  );
}

function imperialPrimary(): SpecContext {
  const game = pickAll(started());
  const actor = activeOf(game);
  const card = game.strategyCards[CROWN] as StrategyCardState;
  const strategyCards = { ...game.strategyCards, [CROWN]: { ...card, holder: actor } };
  return contextOf(withPublic({ ...game, strategyCards }, actor), actor);
}

function secondary(card: typeof CROWN, change = (game: GameState) => game): SpecContext {
  const game = pickAll(started());
  const turn = game.actionPhase;
  if (turn === null) throw new Error('keine Aktionsphase');
  const actor = game.players.find((player) => player.id !== turn.active)?.id as PlayerId;
  const open = {
    ...game,
    actionPhase: { ...turn, secondary: { card, awaiting: [actor], free: [] } },
  };
  return contextOf(change(open), actor, card);
}

/** Drei fremde Planeten gehören dem Spieler und sind erschöpft. */
function exhaustedThree(game: GameState, player: PlayerId): GameState {
  const taken = Object.values(game.planets)
    .filter((planet) => planet.controller === null)
    .slice(0, 3)
    .map((planet) => ({ ...planet, controller: player, exhausted: true }));
  return {
    ...game,
    planets: { ...game.planets, ...Object.fromEntries(taken.map((p) => [p.id, p])) },
  };
}

const diplomacy = (): SpecContext => {
  const holder = secondary(EMBASSY);
  return { ...holder, game: exhaustedThree(holder.game, holder.actor) };
};

function played(spec: AnySpec, ctx: SpecContext, actions: readonly TableAction[]): TableDraft {
  return actions.reduce((draft, action) => spec.apply(ctx, draft, action), spec.initial(ctx));
}

const pick = (objective: typeof GOODS | null): TableAction => ({ kind: 'objective', objective });
const coin: TableAction = { kind: 'tradeGoods', delta: 1 };
const coins = (count: number): TableAction[] => Array.from({ length: count }, () => coin);
const tap = (planet: PlanetId): TableAction => ({ kind: 'planet', planet });
const probe = (ctx: SpecContext, command: GameCommand) => tryCommand(ctx.game, command);

describe('Aufträge und Diplomatie am Tisch', () => {
  it('ohne Wahl beendet das Siegel die Wertung', () => {
    const ctx = scoring();
    const spec = TABLE_SPECS.scoring;
    const draft = spec.initial(ctx);
    expect(spec.progress(ctx, draft)).toEqual({ done: 0, needed: 0, ready: true });
    expect(spec.confirm(ctx, draft)).toBe('doneScoring');
    expect(spec.command(ctx, draft)).toEqual({ type: 'EndScoring', issuedBy: ctx.actor });
    expect(spec.alternative?.(ctx, draft)).toBeNull();
    expect(spec.hint(ctx)).toBe('tableHintScoring');
    expect(spec.targets(ctx, draft).get(`card:${GOODS}`)).toBe('legal');
    expect(spec.targets(ctx, draft).has(`card:${FAR}`)).toBe(false);
  });

  it('ein erfüllter Auftrag wird gewählt, ein zweiter Klick legt ihn zurück', () => {
    const ctx = scoring();
    const spec = TABLE_SPECS.scoring;
    const chosen = played(spec, ctx, [pick(GOODS)]);
    expect(chosen).toEqual({ kind: 'objective', objective: GOODS, payment: null });
    expect(spec.targets(ctx, chosen).get(`card:${GOODS}`)).toBe('chosen');
    expect(spec.confirm(ctx, chosen)).toBe('score');
    expect(spec.command(ctx, chosen)).toEqual({
      type: 'ScoreObjective',
      issuedBy: ctx.actor,
      objective: GOODS,
      payment: { planets: [], tradeGoods: 5 },
    });
    expect(played(spec, ctx, [pick(GOODS), pick(GOODS)])).toMatchObject({ objective: null });
    expect(played(spec, ctx, [pick(FAR)])).toMatchObject({ objective: null });
    expect(spec.planets?.(ctx, chosen)).toBeNull();
  });

  it('Ausgabe-Aufträge verlangen Bezahlung; Zurück gibt die Wahl frei', () => {
    const ctx = scoring();
    const spec = TABLE_SPECS.scoring;
    const opened = played(spec, ctx, [pick(WAR_CHEST)]);
    expect(opened).toMatchObject({
      payment: { currency: 'resources', planets: [], tradeGoods: 0 },
    });
    expect(spec.progress(ctx, opened)).toEqual({ done: 0, needed: 8, ready: false });
    const [first] = spendablePlanets(ctx.game, content.tiles, ctx.actor, 'resources');
    if (first === undefined) throw new Error('kein Planet');
    const paid = played(spec, ctx, [pick(WAR_CHEST), tap(first.planet), ...coins(8)]);
    expect(spec.progress(ctx, paid)).toEqual({ done: first.value + 8, needed: 8, ready: true });
    expect(spec.targets(ctx, paid).get(`planet:${first.planet}`)).toBe('chosen');
    expect(spec.planets?.(ctx, paid)).toMatchObject({ mode: 'pay', required: 8, tradeGoods: 8 });
    const back = spec.alternative?.(ctx, paid);
    expect(back).toEqual({ label: 'cancel', action: pick(null) });
    expect(back?.action && spec.apply(ctx, paid, back.action)).toMatchObject({ objective: null });
  });

  it('Imperium primär: nur erfüllte öffentliche Aufträge sind wählbar', () => {
    const ctx = imperialPrimary();
    const spec = TABLE_SPECS.imperial;
    const start = spec.initial(ctx);
    expect(spec.hint(ctx)).toBe('tableHintImperial');
    expect(spec.confirm(ctx, start)).toBe('confirm');
    expect(spec.progress(ctx, start).ready).toBe(true);
    expect(played(spec, ctx, [pick(FAR)])).toEqual(start);
    const chosen = played(spec, ctx, [pick(GOODS)]);
    expect(chosen).toMatchObject({ objective: GOODS });
    expect(spec.alternative?.(ctx, chosen)).toEqual({ label: 'noObjective', action: pick(null) });
    expect(spec.alternative?.(ctx, start)).toBeNull();
    expect(spec.command(ctx, chosen)).toMatchObject({
      type: 'PerformStrategicAction',
      card: CROWN,
      choice: { mechanic: 'imperial', objective: GOODS, payment: { tradeGoods: 5 } },
    });
  });

  it('Imperium sekundär zieht einen geheimen Auftrag', () => {
    const ctx = secondary(CROWN);
    const spec = TABLE_SPECS.imperial;
    const draft = played(spec, ctx, [pick(GOODS)]);
    expect(spec.hint(ctx)).toBe('tableHintDrawSecret');
    expect(spec.confirm(ctx, draft)).toBe('drawSecret');
    expect(spec.targets(ctx, draft).size).toBe(0);
    expect(spec.command(ctx, draft)).toEqual({
      type: 'ResolveSecondary',
      issuedBy: ctx.actor,
      choice: { mechanic: 'imperial', objective: null, payment: { planets: [], tradeGoods: 0 } },
    });
  });

  it('Diplomatie sekundär: höchstens so viele erschöpfte Planeten wie erlaubt', () => {
    const ctx = diplomacy();
    const spec = TABLE_SPECS.diplomacy;
    const side = spec.planets?.(ctx, spec.initial(ctx));
    const offered = side?.offered ?? [];
    expect(side).toMatchObject({ mode: 'ready', limit: 2, currency: null });
    expect(offered.length).toBeGreaterThanOrEqual(3);
    const [a, b, c] = offered as [PlanetId, PlanetId, PlanetId];
    const full = played(spec, ctx, [tap(a), tap(b), tap(c)]);
    expect(full).toEqual({ kind: 'ready', planets: [a, b] });
    expect(spec.progress(ctx, full)).toEqual({ done: 2, needed: 2, ready: true });
    expect(spec.targets(ctx, full).has(`planet:${c}`)).toBe(false);
    expect(played(spec, ctx, [tap(a), tap(a)])).toEqual({ kind: 'ready', planets: [] });
    expect(spec.confirm(ctx, full)).toBe('readyPlanets');
    expect(spec.hint(ctx)).toBe('tableHintDiplomacy');
  });

  it('jeder gebaute Befehl besteht die Probe der Domain', () => {
    const score = scoring();
    const war = played(TABLE_SPECS.scoring, score, [pick(WAR_CHEST), ...coins(8)]);
    const goods = played(TABLE_SPECS.scoring, score, [pick(GOODS)]);
    const imperial = imperialPrimary();
    const follower = secondary(CROWN);
    const ready = diplomacy();
    const offered = TABLE_SPECS.diplomacy.planets?.(ready, { kind: 'ready', planets: [] });
    const tapped = (offered?.offered ?? []).slice(0, 2).map(tap);
    const cases: readonly [SpecContext, AnySpec, TableDraft][] = [
      [score, TABLE_SPECS.scoring, TABLE_SPECS.scoring.initial(score)],
      [score, TABLE_SPECS.scoring, war],
      [score, TABLE_SPECS.scoring, goods],
      [imperial, TABLE_SPECS.imperial, played(TABLE_SPECS.imperial, imperial, [pick(GOODS)])],
      [imperial, TABLE_SPECS.imperial, TABLE_SPECS.imperial.initial(imperial)],
      [follower, TABLE_SPECS.imperial, TABLE_SPECS.imperial.initial(follower)],
      [ready, TABLE_SPECS.diplomacy, played(TABLE_SPECS.diplomacy, ready, tapped)],
    ];
    for (const [ctx, spec, draft] of cases) {
      const result = probe(ctx, spec.command(ctx, draft));
      expect(result.ok ? 'ok' : result.error.code).toBe('ok');
    }
  });
});
