import { type GameState, type PlayerId, strategyCardId, updatePlayer } from '@stellar/domain';
import { describe, expect, it } from 'vitest';
import { content } from '../src/store.ts';
import { decisionOf, type DecisionRoute } from '../src/table/decision-route.ts';
import { productionPlan } from '../src/table/production-draft.ts';
import { secondarySocket } from '../src/table/secondary-socket.ts';
import { socketPlayOf } from '../src/table/socket-play.ts';
import { type TableDraft, tableSpecOf } from '../src/table/table-specs.ts';
import type { TableDecision } from '../src/table/use-table-decision.ts';
import { pickAll, started } from './game-helpers.ts';

/** Ein Mitspieler des Aktiven entscheidet über die Sekundärfähigkeit der Karte. */
function following(card: string, free: readonly PlayerId[] = []) {
  const game = pickAll(started());
  const turn = game.actionPhase;
  if (turn === null) throw new Error('keine Aktionsphase');
  const actor = game.players.find((player) => player.id !== turn.active)?.id as PlayerId;
  const secondary = { card: strategyCardId(card), awaiting: [actor], free };
  return { game: { ...game, actionPhase: { ...turn, secondary } }, actor };
}

function routeOf(game: GameState, actor: PlayerId): DecisionRoute {
  const route = decisionOf({ game, actor, waitingOn: null, chosen: null });
  if (route === null) throw new Error('keine Entscheidung');
  return route;
}

const socketOf = (game: GameState, actor: PlayerId) =>
  secondarySocket(game, routeOf(game, actor), content);

describe('Sockel der Sekundärfähigkeit', () => {
  it('eine übliche Karte kostet einen Strategiemarker', () => {
    const { game, actor } = following('embassy');
    expect(socketOf(game, actor)).toEqual({
      card: strategyCardId('embassy'),
      mechanic: 'diplomacy',
      cost: 1,
      waived: false,
      affordable: true,
    });
  });

  it('Führung ist kostenlos, ohne dass etwas erlassen wäre', () => {
    const { game, actor } = following('vanguard');
    expect(socketOf(game, actor)).toMatchObject({ cost: 0, waived: false, affordable: true });
  });

  it('ein Freibrief des Handels erlässt die Kosten', () => {
    const { game, actor } = following('exchange');
    const waived = following('exchange', [actor]);
    expect(socketOf(game, actor)).toMatchObject({ cost: 1, waived: false });
    expect(socketOf(waived.game, waived.actor)).toMatchObject({ cost: 0, waived: true });
  });

  it('ohne Strategiemarker ist die Sekundärfähigkeit nicht bezahlbar', () => {
    const { game, actor } = following('embassy');
    const empty = updatePlayer(game, actor, (player) => ({
      ...player,
      commandPools: { ...player.commandPools, strategy: 0 },
    }));
    expect(socketOf(empty, actor)).toMatchObject({ cost: 1, affordable: false });
  });

  it('außerhalb einer Sekundärfähigkeit gibt es keinen Sockel', () => {
    const game = pickAll(started());
    const actor = game.actionPhase?.active as PlayerId;
    expect(socketOf(game, actor)).toBeNull();
  });
});

/** Eine Tischentscheidung, wie der Hook sie liefert, mit Bereitschaft des Entwurfs. */
function decisionAt(
  game: GameState,
  actor: PlayerId,
  ready: boolean,
  draft: TableDraft | null = null,
): TableDecision {
  const route = routeOf(game, actor);
  const confirm = () => undefined;
  const specId = tableSpecOf(route, content);
  const progress = { done: 0, needed: 1, ready };
  return { route, specId, draft, progress, confirm } as TableDecision;
}

/** Eine Werft mit einem bestellten Jäger. */
const orderedYard = (): TableDraft => ({ ...productionPlan(null), orders: { fighter: 1 } });

describe('Sockel und Tischentscheidungen der Sekundärfähigkeit', () => {
  it('Technologie und Kriegsführung sekundär werden am Tisch gespielt', () => {
    const research = following('research');
    const armament = following('armament');
    expect(tableSpecOf(routeOf(research.game, research.actor), content)).toBe('technology');
    expect(tableSpecOf(routeOf(armament.game, armament.actor), content)).toBe('warfareSecondary');
  });

  it('solange der Entwurf nicht bereit ist, wartet der Sockel auf die Wahl am Tisch', () => {
    const { game, actor } = following('research');
    const play = socketPlayOf(socketOf(game, actor), decisionAt(game, actor, false));
    expect(play).toEqual({ play: null, takesToken: false, awaitsDraft: true });
  });

  it('ein bereiter Entwurf geht über das Siegel, der Sockel nimmt den Strategiemarker', () => {
    const { game, actor } = following('armament');
    const decision = decisionAt(game, actor, true, orderedYard());
    const play = socketPlayOf(socketOf(game, actor), decision);
    expect(play).toEqual({ play: decision.confirm, takesToken: true, awaitsDraft: false });
  });

  it('eine leere Werft lässt den Sockel warten, auch wenn ihr Siegel bereit wäre', () => {
    const { game, actor } = following('armament');
    const decision = decisionAt(game, actor, true, productionPlan(null));
    const play = socketPlayOf(socketOf(game, actor), decision);
    expect(play).toEqual({ play: null, takesToken: false, awaitsDraft: true });
  });

  it('ohne Strategiemarker wartet nichts: der Sockel bleibt zu', () => {
    const { game, actor } = following('research');
    const empty = updatePlayer(game, actor, (player) => ({
      ...player,
      commandPools: { ...player.commandPools, strategy: 0 },
    }));
    const play = socketPlayOf(socketOf(empty, actor), decisionAt(empty, actor, false));
    expect(play).toEqual({ play: null, takesToken: false, awaitsDraft: false });
  });
});
