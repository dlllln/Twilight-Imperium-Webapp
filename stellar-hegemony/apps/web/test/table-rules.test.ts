import { type GameState, type PlayerId, systemId } from '@stellar/domain';
import { describe, expect, it } from 'vitest';
import { handEntries } from '../src/hand/hand-model.ts';
import { systemActions } from '../src/hud/system-actions.ts';
import { tryCommand } from '../src/rules-preview.ts';
import { gameScene } from '../src/render/scene-model.ts';
import { content } from '../src/store.ts';
import { legalFor } from '../src/table/carry-rules.ts';
import { liftedTokenOf, withoutLifted } from '../src/table/lifted-token.ts';
import { activatableSystems, canActivateNow } from '../src/table/legal-systems.ts';
import { poolDraft } from '../src/table/pool-draft.ts';
import type { TokenPlan } from '../src/table/table-specs.ts';
import { GOODS_PIECE, KASSE, poolTarget, systemTarget } from '../src/table/target-ref.ts';
import { dropIntent } from '../src/table/use-drop-router.ts';
import type { TableDecision } from '../src/table/use-table-decision.ts';
import { pickAll, started } from './game-helpers.ts';

const activeOf = (game: GameState): PlayerId => game.actionPhase?.active as PlayerId;

const allowedByDomain = (game: GameState, actor: PlayerId) =>
  Object.keys(game.systems).filter(
    (id) => tryCommand(game, { type: 'ActivateSystem', issuedBy: actor, system: systemId(id) }).ok,
  );

const TACTIC = poolTarget('tactic');

/** Aktionsphase; im ersten System liegt schon ein Marker des Aktiven (dort keine Aktivierung). */
function markedGame(): GameState {
  const game = pickAll(started());
  const [first] = Object.keys(game.systems);
  const system = game.systems[first ?? ''];
  if (first === undefined || system === undefined) throw new Error('keine Systeme');
  const marked = { ...system, commandTokens: [activeOf(game)] };
  return { ...game, systems: { ...game.systems, [first]: marked } };
}

describe('Regeln am Tisch', () => {
  it('nur Systeme, die die Domain aktivieren lässt, sind Ziele des Taktikmarkers', () => {
    const game = markedGame();
    const actor = activeOf(game);
    const allowed = allowedByDomain(game, actor);
    expect(allowed.length).toBeGreaterThan(0);
    expect(allowed.length).toBeLessThan(Object.keys(game.systems).length);
    expect([...activatableSystems(game, actor)]).toEqual(allowed);
    expect(activatableSystems(game, actor)).toBe(activatableSystems(game, actor));
    const input = { game, actor, choosing: false, draft: null, coins: null };
    expect([...legalFor(input, TACTIC)]).toEqual(allowed.map((id) => `system:${id}`));
    expect(legalFor(input, poolTarget('fleet')).size).toBe(0);
    const other = game.players.find((player) => player.id !== actor)?.id as PlayerId;
    expect(activatableSystems(game, other)).toEqual([]);
    const [first] = allowed;
    const send = { type: 'ActivateSystem', issuedBy: actor, system: first };
    const route = { game, actor, choosing: false, specId: null, draft: null };
    expect(dropIntent(route, TACTIC, systemTarget(first ?? ''))).toEqual({
      kind: 'send',
      command: send,
    });
  });

  it('mit gewählter strategischer Aktion lässt sich nichts aktivieren', () => {
    const game = pickAll(started());
    const actor = activeOf(game);
    const [first] = allowedByDomain(game, actor);
    if (first === undefined) throw new Error('kein System aktivierbar');
    expect(canActivateNow(game, actor, first, false)).toBe(true);
    expect(canActivateNow(game, actor, first, true)).toBe(false);
    expect(systemActions(game, actor, first, true)).toEqual(['view']);
    expect(legalFor({ game, actor, choosing: true, draft: null, coins: null }, TACTIC).size).toBe(
      0,
    );
    const route = { game, actor, choosing: true, specId: null, draft: null };
    expect(dropIntent(route, TACTIC, systemTarget(first))).toBeNull();
  });

  it('die Karte Taktische Aktion ist nur bei erlaubtem System spielbar', () => {
    const game = markedGame();
    const actor = activeOf(game);
    const allowed = allowedByDomain(game, actor);
    const refused = Object.keys(game.systems).find((id) => !allowed.includes(id));
    const tactical = (selected: string | undefined) =>
      handEntries({ game, actor, viewer: actor, selected: selected ?? null, choosing: false }).find(
        (entry) => entry.kind === 'tactical',
      );
    expect(tactical(allowed[0])?.playable).toBe(true);
    expect(refused).toBeDefined();
    expect(tactical(refused)?.playable).toBe(false);
    expect(tactical(undefined)?.playable).toBe(false);
  });

  it('während einer Verteilung wandern Marker nur zwischen Schale und Leisten', () => {
    const game = pickAll(started());
    const actor = activeOf(game);
    const pools = poolDraft({ tactic: 3, fleet: 3, strategy: 2 }, 1, true);
    const draft: TokenPlan = { kind: 'tokens', pools, tradeGoods: 0, planets: [], system: null };
    const input = { game, actor, choosing: true, draft, coins: null };
    expect([...legalFor(input, poolTarget('loose'))]).toEqual([
      'pool:tactic',
      'pool:fleet',
      'pool:strategy',
    ]);
    expect(legalFor(input, TACTIC).size).toBe(0);
    const route = { ...input, specId: 'leadership' as const };
    const move = { kind: 'move', from: 'loose', to: 'fleet' };
    expect(dropIntent(route, poolTarget('loose'), poolTarget('fleet'))).toEqual({
      kind: 'act',
      action: move,
    });
    expect(dropIntent(route, TACTIC, systemTarget('18'))).toBeNull();
    const war = { ...route, specId: 'warfare' as const };
    const pick = { kind: 'system', system: '18' };
    expect(dropIntent(war, TACTIC, systemTarget('18'))).toEqual({ kind: 'act', action: pick });
  });

  it('Kriegsführung: der aufgenommene Marker fehlt schon vor dem Absenden auf der Karte', () => {
    const game = markedGame();
    const actor = activeOf(game);
    const first = Object.keys(game.systems)[0] ?? '';
    const tokensOn = (state: GameState) =>
      gameScene(state, content, 'de').find((hex) => hex.systemId === first)?.tokens;
    const decision = (specId: string | null, system: string | null) =>
      ({ specId, draft: { kind: 'tokens', system }, route: { actor } }) as unknown as TableDecision;
    const lifted = liftedTokenOf(decision('warfare', first));
    expect(lifted).toEqual({ system: first, player: actor });
    expect(liftedTokenOf(decision('warfare', null))).toBeNull();
    expect(liftedTokenOf(decision('tokens', first))).toBeNull();
    expect(tokensOn(game)).toHaveLength(1);
    expect(tokensOn(withoutLifted(game, lifted))).toHaveLength(0);
    expect(withoutLifted(game, null)).toBe(game);
  });

  it('eine Handelsware darf in die Kasse, zurück nur, was dort liegt', () => {
    const game = pickAll(started());
    const actor = activeOf(game);
    const input = (spent: number, own: number) => ({
      game,
      actor,
      choosing: false,
      draft: null,
      coins: { spent, own },
    });
    expect([...legalFor(input(0, 2), GOODS_PIECE)]).toEqual(['slot:kasse']);
    expect(legalFor(input(0, 2), KASSE).size).toBe(0);
    expect([...legalFor(input(1, 2), KASSE)]).toEqual(['goods:tradeGoods']);
    expect(legalFor(input(2, 2), GOODS_PIECE).size).toBe(0);
    expect(legalFor({ ...input(0, 2), coins: null }, GOODS_PIECE).size).toBe(0);
    const route = { game, actor, choosing: false, specId: null, draft: null };
    expect(dropIntent(route, GOODS_PIECE, KASSE)).toEqual({ kind: 'coins', delta: 1 });
    expect(dropIntent(route, KASSE, GOODS_PIECE)).toEqual({ kind: 'coins', delta: -1 });
    expect(dropIntent(route, GOODS_PIECE, systemTarget('18'))).toBeNull();
  });
});
