import {
  actionCardId,
  type GameCommand,
  type GameState,
  type PlayerId,
  strategyCardId,
  type StrategyCardState,
} from '@stellar/domain';
import { describe, expect, it } from 'vitest';
import { tryCommand } from '../src/rules-preview.ts';
import { decisionOf } from '../src/table/decision-route.ts';
import { discardCount, toggleDiscard } from '../src/table/spec-discard.ts';
import {
  type AnySpec,
  type SpecContext,
  TABLE_SPECS,
  type TableAction,
  type TableDraft,
  takesPlayer,
} from '../src/table/table-specs.ts';
import { actionPiece, playerTarget, SPEAKER_PIECE, targetKey } from '../src/table/target-ref.ts';
import { pickAll, started } from './game-helpers.ts';

const SENATE = strategyCardId('senate');
const EXCHANGE = strategyCardId('exchange');
const MARKET = actionCardId('black-market');
const RECALL = actionCardId('recall');
const INTEL = actionCardId('intelligence');

const activeOf = (game: GameState): PlayerId => game.actionPhase?.active as PlayerId;

function contextOf(game: GameState, actor: PlayerId, chosen = SENATE): SpecContext {
  const route = decisionOf({ game, actor, waitingOn: null, chosen });
  if (route === null) throw new Error('keine Entscheidung');
  return { game, actor, route };
}

/** Der Aktive hält die Karte und hat sie aus der Hand gewählt. */
function primary(card: typeof SENATE): SpecContext {
  const game = pickAll(started());
  const actor = activeOf(game);
  const held = { ...(game.strategyCards[card] as StrategyCardState), holder: actor };
  return contextOf(
    { ...game, strategyCards: { ...game.strategyCards, [card]: held } },
    actor,
    card,
  );
}

/** Der Aktive hat zwei Karten über dem Limit: zwei Marktkarten, ein Rückruf, sonst Aufklärung. */
function overLimit(): SpecContext {
  const game = pickAll(started());
  const actor = activeOf(game);
  const size = game.config.rules.actionCardHandLimit + 2;
  const hand = [MARKET, MARKET, RECALL, ...Array.from({ length: size - 3 }, () => INTEL)];
  const players = game.players.map((p) => (p.id === actor ? { ...p, actionCards: hand } : p));
  return contextOf({ ...game, players }, actor);
}

/** Ein offenes Zeitfenster, in dem ein Mitspieler entscheidet; wahlweise mit offener Karte. */
function reacting(pending: boolean): SpecContext {
  const game = pickAll(started());
  const actor = game.players.find((p) => p.id !== activeOf(game))?.id as PlayerId;
  const reactionWindow = { kind: 'afterActivation' as const, awaiting: [actor], played: [] };
  const pendingPlay = { player: activeOf(game), card: MARKET, target: {}, awaiting: [actor] };
  return contextOf({ ...game, reactionWindow, pendingPlay: pending ? pendingPlay : null }, actor);
}

const played = (spec: AnySpec, ctx: SpecContext, actions: readonly TableAction[]): TableDraft =>
  actions.reduce((draft, action) => spec.apply(ctx, draft, action), spec.initial(ctx));

const probe = (ctx: SpecContext, command: GameCommand) => tryCommand(ctx.game, command).ok;

const pick = (player: PlayerId): TableAction => ({ kind: 'player', player });

const tapCard = (card: typeof MARKET): TableAction => ({ kind: 'card', card });

describe('Ablegen über dem Limit am Tisch', () => {
  it('Antippen nimmt je Exemplar eines dazu und dann alle zurück', () => {
    expect(toggleDiscard([], MARKET, 2, 2)).toEqual([MARKET]);
    expect(toggleDiscard([MARKET], MARKET, 2, 2)).toEqual([MARKET, MARKET]);
    expect(toggleDiscard([MARKET, MARKET], MARKET, 2, 2)).toEqual([]);
    expect(toggleDiscard([MARKET], MARKET, 1, 2)).toEqual([]);
  });

  it('mehr als nötig lässt sich nicht vormerken', () => {
    expect(toggleDiscard([MARKET, RECALL], INTEL, 3, 2)).toEqual([MARKET, RECALL]);
    expect(toggleDiscard([MARKET, RECALL], RECALL, 1, 2)).toEqual([MARKET]);
  });

  it('die Route über dem Limit spielt das Ablegen mit Siegel „Ablegen“', () => {
    const ctx = overLimit();
    const spec = TABLE_SPECS.discard;
    expect(ctx.route.kind).toBe('discard');
    const start = spec.initial(ctx);
    expect(spec.hint(ctx)).toBe('tableHintDiscard');
    expect(spec.confirm(ctx, start)).toBe('discard');
    expect(spec.progress(ctx, start)).toEqual({ done: 0, needed: 2, ready: false });
    const draft = played(spec, ctx, [tapCard(MARKET), tapCard(RECALL), tapCard(INTEL)]);
    expect(draft).toEqual({ kind: 'discard', cards: [MARKET, RECALL] });
    expect(spec.progress(ctx, draft)).toEqual({ done: 2, needed: 2, ready: true });
    expect(discardCount(draft, MARKET)).toBe(1);
    expect(discardCount(null, MARKET)).toBe(0);
    expect(spec.targets(ctx, draft).get(targetKey(actionPiece(RECALL)))).toBe('chosen');
    expect(spec.targets(ctx, draft).has(targetKey(actionPiece(INTEL)))).toBe(false);
  });
});

describe('Reaktion am Tisch', () => {
  it('ohne offene Karte heißt das Siegel „Keine Karte spielen“, sonst „Nicht verhindern“', () => {
    const open = reacting(false);
    const spec = TABLE_SPECS.reaction;
    expect(open.route.kind).toBe('reaction');
    expect(spec.confirm(open, spec.initial(open))).toBe('passReaction');
    const pending = reacting(true);
    expect(spec.confirm(pending, spec.initial(pending))).toBe('allowCard');
    expect(spec.hint(open)).toBe('tableHintReaction');
    expect(spec.progress(open, spec.initial(open)).ready).toBe(true);
  });
});

describe('Politik und Handel am Tisch', () => {
  it('Politik: der erste Mitspieler ohne Sprechermarker ist vorgewählt, Antippen wechselt', () => {
    const ctx = primary(SENATE);
    const spec = TABLE_SPECS.politics;
    const candidates = ctx.game.players.filter((p) => p.id !== ctx.game.speaker).map((p) => p.id);
    const start = spec.initial(ctx);
    expect(start).toEqual({ kind: 'players', players: [candidates[0]] });
    expect(spec.confirm(ctx, start)).toBe('confirm');
    const other = candidates[1] as PlayerId;
    const moved = spec.apply(ctx, start, pick(other));
    expect(moved).toEqual({ kind: 'players', players: [other] });
    expect(spec.apply(ctx, moved, pick(ctx.game.speaker as PlayerId))).toEqual(moved);
    const targets = spec.targets(ctx, moved);
    expect(targets.get(targetKey(playerTarget(other)))).toBe('chosen');
    expect(targets.get(targetKey(playerTarget(candidates[0] as PlayerId)))).toBe('legal');
    const legal = spec.legal?.(ctx, moved, SPEAKER_PIECE);
    expect([...(legal ?? [])]).toEqual(candidates.map((id) => targetKey(playerTarget(id))));
    expect(takesPlayer('politics')).toBe(true);
    expect(takesPlayer('warfare')).toBe(false);
  });

  it('Handel: Antippen gibt Mitspielern einen Freibrief und nimmt ihn wieder', () => {
    const ctx = primary(EXCHANGE);
    const spec = TABLE_SPECS.trade;
    const [first, second] = ctx.game.players.filter((p) => p.id !== ctx.actor).map((p) => p.id);
    const draft = played(spec, ctx, [pick(first as PlayerId), pick(second as PlayerId)]);
    expect(draft).toEqual({ kind: 'players', players: [first, second] });
    const back = spec.apply(ctx, draft, pick(first as PlayerId));
    expect(back).toEqual({ kind: 'players', players: [second] });
    expect(spec.apply(ctx, back, pick(ctx.actor))).toEqual(back);
    expect(spec.targets(ctx, back).get(targetKey(playerTarget(first as PlayerId)))).toBe('legal');
    expect(spec.progress(ctx, spec.initial(ctx)).ready).toBe(true);
  });

  it('jeder gebaute Befehl besteht die Probe der Domain', () => {
    const discard = overLimit();
    const discardDraft = played(TABLE_SPECS.discard, discard, [tapCard(MARKET), tapCard(MARKET)]);
    expect(probe(discard, TABLE_SPECS.discard.command(discard, discardDraft))).toBe(true);
    const reaction = reacting(false);
    const pass = TABLE_SPECS.reaction.command(reaction, TABLE_SPECS.reaction.initial(reaction));
    expect(probe(reaction, pass)).toBe(true);
    const politics = primary(SENATE);
    const speaker = TABLE_SPECS.politics.initial(politics);
    expect(probe(politics, TABLE_SPECS.politics.command(politics, speaker))).toBe(true);
    const trade = primary(EXCHANGE);
    const other = trade.game.players.find((p) => p.id !== trade.actor)?.id as PlayerId;
    const free = played(TABLE_SPECS.trade, trade, [pick(other)]);
    expect(probe(trade, TABLE_SPECS.trade.command(trade, free))).toBe(true);
  });
});
