import { type GameState, type PlayerId, strategyCardId, updatePlayer } from '@stellar/domain';
import { describe, expect, it } from 'vitest';
import { content } from '../src/store.ts';
import { decisionOf, type DecisionRoute } from '../src/table/decision-route.ts';
import { secondarySocket } from '../src/table/secondary-socket.ts';
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
