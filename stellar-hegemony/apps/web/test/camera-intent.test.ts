import {
  adjacentSystemIds,
  currentActor,
  type GameState,
  type PlanetId,
  type PlayerId,
  type SystemId,
} from '@stellar/domain';
import { describe, expect, it } from 'vitest';
import { homeSystemOf } from '../src/card-view.ts';
import { tryCommand } from '../src/rules-preview.ts';
import { content } from '../src/store.ts';
import { framingOf } from '../src/table/camera-intent.ts';
import { decisionOf, type DecisionRoute } from '../src/table/decision-route.ts';
import {
  KASSE,
  planetTarget,
  poolTarget,
  siteTarget,
  systemTarget,
  targetKey,
  type TargetRef,
  type TargetState,
} from '../src/table/target-ref.ts';
import { movementChoices } from '../src/tactical-view.ts';
import { pickAll, started } from './game-helpers.ts';

const routeOf = (game: GameState, actor: PlayerId): DecisionRoute => {
  const route = decisionOf({ game, actor, waitingOn: null, chosen: null });
  if (route === null) throw new Error('keine Entscheidung');
  return route;
};

const targets = (...refs: readonly TargetRef[]): ReadonlyMap<string, TargetState> =>
  new Map(refs.map((ref) => [targetKey(ref), 'legal']));

/** Ein Nachbarsystem der Heimat ist aktiviert, Schiffe können es erreichen. */
function moving(): {
  readonly game: GameState;
  readonly player: PlayerId;
  readonly home: SystemId;
} {
  const game = pickAll(started());
  const player = currentActor(game) as PlayerId;
  const home = homeSystemOf(game, player, content) as SystemId;
  const origin = game.systems[home] as GameState['systems'][string];
  for (const system of adjacentSystemIds(game.systems, origin)) {
    const next = tryCommand(game, { type: 'ActivateSystem', issuedBy: player, system });
    if (next.ok && movementChoices(next.value, content).length > 0)
      return { game: next.value, player, home };
  }
  throw new Error('kein erreichbares Nachbarsystem');
}

describe('Was die Kamera für die Entscheidung ins Bild nimmt', () => {
  it('ohne Entscheidung und ohne Ziele auf der Karte bleibt das Bild, wie es ist', () => {
    const game = pickAll(started());
    const player = currentActor(game) as PlayerId;
    expect(framingOf(game, null, targets(systemTarget('18')))).toEqual([]);
    expect(framingOf(game, routeOf(game, player), new Map())).toEqual([]);
    expect(framingOf(game, routeOf(game, player), targets(poolTarget('tactic'), KASSE))).toEqual(
      [],
    );
  });

  it('in der Bewegung: das aktivierte System und die Herkunft der Schiffe, jedes einmal', () => {
    const { game, player, home } = moving();
    const active = game.actionPhase?.tactical?.system as SystemId;
    const framed = framingOf(game, routeOf(game, player), new Map());
    expect(framed[0]).toBe(active);
    expect(framed).toContain(home);
    expect(new Set(framed).size).toBe(framed.length);
  });

  it('Systeme und Bauplätze unter den Zielen kommen ins Bild, Planeten der Bezahlung nicht', () => {
    const game = pickAll(started());
    const player = currentActor(game) as PlayerId;
    const home = homeSystemOf(game, player, content) as SystemId;
    const planet = game.systems[home]?.planetIds[0] as PlanetId;
    const other = Object.keys(game.systems).find((id) => id !== home) as SystemId;
    const route = routeOf(game, player);
    expect(framingOf(game, route, targets(siteTarget(planet)))).toEqual([home]);
    expect(framingOf(game, route, targets(planetTarget(planet)))).toEqual([]);
    expect(framingOf(game, route, targets(systemTarget(other), siteTarget(planet)))).toEqual([
      other,
      home,
    ]);
  });
});
