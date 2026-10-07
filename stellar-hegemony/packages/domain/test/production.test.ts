import { describe, expect, it } from 'vitest';
import {
  bombardHandler,
  commitGroundForcesHandler,
  endTacticalActionHandler,
  type GameState,
  planetId,
  type PlanetId,
  produceUnitsHandler,
  type SystemState,
  productionCost,
  type UnitTypeId,
  updatePlayer,
} from '../src/index.ts';
import { activate, board, moves, type Spec } from './board.ts';
import { BLUE, contextWith, RED, T, unit, units } from './fixtures.ts';
import { actionPhaseGame, run, step } from './game-flow.ts';

const WORLD = planetId('gamma-1');

/** Rot aktiviert `b` mit eigenem Dock auf Gamma-1 (3 Ressourcen) und bewegt nichts. */
function atDock(extra: Partial<Spec> = {}, tradeGoods = 20): GameState {
  const home: Spec = { id: 'b', q: 1, planet: [unit(T.dock)], planetId: 'gamma-1', ...extra };
  const activated = run(board({ id: 'a', q: 0 }, home), [activate('b')]);
  const rich = updatePlayer(activated, RED, (player) => ({ ...player, tradeGoods }));
  return step(rich, moves()).state;
}

const produce = (
  orders: readonly { type: UnitTypeId; count: number }[],
  tradeGoods: number,
  groundPlanet: PlanetId | null = null,
) =>
  ({
    type: 'ProduceUnits',
    issuedBy: RED,
    orders,
    payment: { planets: [], tradeGoods },
    groundPlanet,
  }) as const;

const tryProduce = (state: GameState, command: ReturnType<typeof produce>) => {
  const result = produceUnitsHandler.decide(state, command, contextWith());
  return result.ok ? 'ok' : result.error.code;
};

describe('Produktion (RR 62, RR 24)', () => {
  it('RR 62.1: Produktionswert = Ressourcen des Planeten + Bonus des Docks', () => {
    const state = atDock();
    expect(state.actionPhase?.tactical?.step).toBe('production');
    expect(tryProduce(state, produce([{ type: T.cruiser, count: 6 }], 12))).toBe(
      'production.limit',
    );
    expect(
      tryProduce(
        state,
        produce(
          [
            { type: T.fighter, count: 2 },
            { type: T.cruiser, count: 3 },
          ],
          7,
        ),
      ),
    ).toBe('ok');
  });

  it('RR 24.2: Paare kosten je angefangenem Paar, Überzahlung verfällt', () => {
    expect(productionCost([])).toBe(0);
    const state = atDock();
    const fighters = [{ type: T.fighter, count: 3 }];
    expect(tryProduce(state, produce(fighters, 1))).toBe('production.cost');
    const after = step(state, produce(fighters, 3));
    expect(after.state.players.find((p) => p.id === RED)?.tradeGoods).toBe(17);
    expect(after.state.systems.b?.spaceUnits.filter((u) => u.type === T.fighter)).toHaveLength(3);
  });

  it('RR 24.5: der Vorrat begrenzt die Zahl der Einheiten', () => {
    const docked = atDock();
    const parked = { ...docked.systems.a, spaceUnits: units(8, T.cruiser) } as SystemState;
    const state = { ...docked, systems: { ...docked.systems, a: parked } };
    expect(tryProduce(state, produce([{ type: T.cruiser, count: 1 }], 2))).toBe(
      'production.componentLimit',
    );
  });

  it('RR 14: blockierte Produktion baut keine Schiffe, aber Bodentruppen', () => {
    const state = atDock({ units: [unit(T.cruiser, BLUE)] });
    expect(tryProduce(state, produce([{ type: T.cruiser, count: 1 }], 2))).toBe(
      'production.blockaded',
    );
    expect(tryProduce(state, produce([{ type: T.infantry, count: 2 }], 1, WORLD))).toBe('ok');
  });

  it('RR 62.3: Bodentruppen erscheinen auf dem eigenen Planeten mit Produktion', () => {
    const state = atDock();
    expect(tryProduce(state, produce([{ type: T.infantry, count: 2 }], 1))).toBe(
      'production.groundPlanet',
    );
    const after = step(state, produce([{ type: T.infantry, count: 2 }], 1, WORLD)).state;
    expect(after.planets[WORLD]?.units.filter((u) => u.type === T.infantry)).toHaveLength(2);
    expect(after.nextUnitNumber).toBe(state.nextUnitNumber + 2);
  });

  it('RR 28/43: Flottenlimit und Kapazität gelten nach der Produktion', () => {
    const state = atDock();
    expect(tryProduce(state, produce([{ type: T.cruiser, count: 4 }], 8))).toBe(
      'production.fleetLimit',
    );
    expect(tryProduce(state, produce([{ type: T.fighter, count: 4 }], 2))).toBe(
      'production.capacity',
    );
  });

  it('Einheiten mit Technologie-Voraussetzung und ungültige Bestellungen', () => {
    const state = atDock();
    expect(tryProduce(state, produce([{ type: T.breaker, count: 1 }], 12))).toBe(
      'production.missingTechnology',
    );
    expect(tryProduce(state, produce([{ type: T.dock, count: 1 }], 0))).toBe(
      'production.notProducible',
    );
    expect(tryProduce(state, produce([{ type: T.cruiser, count: 0 }], 0))).toBe(
      'production.invalidCount',
    );
  });

  it('ohne Taktikaktion gibt es weder Produktion noch Bombardement oder Landung', () => {
    const state = actionPhaseGame();
    expect(tryProduce(state, produce([], 0))).toBe('tactical.notActive');
    const bombard = bombardHandler.decide(
      state,
      { type: 'Bombard', issuedBy: RED, targets: [] },
      contextWith(),
    );
    expect(bombard).toMatchObject({ error: { code: 'tactical.notActive' } });
    const land = commitGroundForcesHandler.decide(
      state,
      { type: 'CommitGroundForces', issuedBy: RED, landings: [], centerPayment: null },
      contextWith(),
    );
    expect(land).toMatchObject({ error: { code: 'tactical.notActive' } });
  });

  it('RR 79.5: nach der Produktion (oder dem Verzicht) endet die Taktikaktion', () => {
    const state = atDock();
    const after = step(state, produce([], 0)).state;
    expect(after.actionPhase?.tactical?.step).toBe('done');
    expect(
      endTacticalActionHandler.decide(after, { type: 'EndTacticalAction', issuedBy: RED }).ok,
    ).toBe(true);
    expect(tryProduce(after, produce([], 0))).toBe('tactical.wrongStep');
  });
});
