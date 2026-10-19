import {
  adjacentSystemIds,
  currentActor,
  type GameState,
  type MovementOption,
  type PlayerId,
  playerId,
  systemId,
  technologyCatalog,
  unitId,
  unitTypeId,
} from '@stellar/domain';
import { describe, expect, it } from 'vitest';
import { homeSystemOf } from '../src/card-view.ts';
import { tryCommand } from '../src/rules-preview.ts';
import { content } from '../src/store.ts';
import { type MovementOrders, moveOrders } from '../src/system/movement-draft.ts';
import { autoLoad, moveSummary, unstageOne } from '../src/table/move-draft.ts';
import { cargoAtOrigin, movementChoices } from '../src/tactical-view.ts';
import { pickAll, started } from './game-helpers.ts';

const CARRIER = unitTypeId('carrier');
const CRUISER = unitTypeId('cruiser');

const option = (id: string, type = CARRIER): MovementOption => ({
  from: systemId('origin'),
  path: [systemId('target')],
  ship: { id: unitId(id), type, owner: playerId('p1'), damaged: false },
});

/** Ein Nachbarsystem der Heimat ist aktiviert, ein Träger von dort kann es erreichen. */
function reachable(): { readonly game: GameState; readonly player: PlayerId } {
  const game = pickAll(started());
  const player = currentActor(game);
  const home = player === null ? null : homeSystemOf(game, player, content);
  const origin = home === null ? undefined : game.systems[home];
  if (player === null || origin === undefined) throw new Error('keine Heimat');
  for (const system of adjacentSystemIds(game.systems, origin)) {
    const next = tryCommand(game, { type: 'ActivateSystem', issuedBy: player, system });
    if (next.ok && movementChoices(next.value, content).some(({ ship }) => ship.type === CARRIER))
      return { game: next.value, player };
  }
  throw new Error('kein erreichbares Nachbarsystem');
}

const capacityOf = (game: GameState, option: MovementOption, player: PlayerId): number =>
  technologyCatalog(game, content).find(option.ship.type, player)?.capacity ?? 0;

describe('Rechnen über dem Bewegungsentwurf', () => {
  it('die Messleiste zählt vorgemerkte Schiffe und ihre Fracht', () => {
    expect(moveSummary({})).toEqual({ ships: 0, cargo: 0 });
    const orders = { a: [unitId('x'), unitId('y')], b: [], c: [unitId('z')] };
    expect(moveSummary(orders)).toEqual({ ships: 3, cargo: 3 });
  });

  it('Fracht laden füllt jeden vorgemerkten Träger bis zur Kapazität und behält vorhandene Fracht', () => {
    const { game, player } = reachable();
    const options = movementChoices(game, content);
    const carrier = options.find(({ ship }) => ship.type === CARRIER) as MovementOption;
    const candidates = cargoAtOrigin(game, content, carrier, player);
    const kept = candidates.at(-1)?.id;
    if (kept === undefined) throw new Error('keine Fracht');
    const loaded = autoLoad(game, content, options, { [carrier.ship.id]: [kept] }, player);
    const cargo = loaded[carrier.ship.id] ?? [];
    expect(cargo[0]).toBe(kept);
    const capacity = capacityOf(game, carrier, player);
    expect(cargo).toHaveLength(Math.min(capacity, candidates.length));
    expect(Object.keys(loaded)).toEqual([carrier.ship.id]);
    const next = tryCommand(game, {
      type: 'MoveShips',
      issuedBy: player,
      moves: moveOrders(options, loaded),
    });
    expect(next.ok).toBe(true);
  });

  it('Fracht laden lädt keine Einheit zweimal und keine vorgemerkten Schiffe', () => {
    const { game, player } = reachable();
    const options = movementChoices(game, content);
    const staged: MovementOrders = Object.fromEntries(options.map(({ ship }) => [ship.id, []]));
    const loaded = autoLoad(game, content, options, staged, player);
    const all = Object.values(loaded).flat();
    expect(new Set(all).size).toBe(all.length);
    for (const id of all) expect(staged[id]).toBeUndefined();
    expect(autoLoad(game, content, options, {}, player)).toEqual({});
  });

  it('ein Schiff einer Art wird zurückgenommen: das zuletzt vorgemerkte, samt Fracht', () => {
    const options = [option('a'), option('b'), option('k', CRUISER)];
    const orders: MovementOrders = { b: [unitId('inf')], a: [], k: [] };
    expect(unstageOne(options, orders, CARRIER)).toEqual({ b: [unitId('inf')], k: [] });
    expect(unstageOne(options, { k: [] }, CARRIER)).toEqual({ k: [] });
    expect(unstageOne(options, orders, CRUISER)).toEqual({ b: [unitId('inf')], a: [] });
  });
});
