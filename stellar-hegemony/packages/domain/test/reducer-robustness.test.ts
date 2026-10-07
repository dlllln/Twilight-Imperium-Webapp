import { describe, expect, it } from 'vitest';
import {
  evolveGame,
  type GameEvent,
  type GameState,
  planetId,
  systemId,
  unitId,
} from '../src/index.ts';
import { CARD, RED, T, unit } from './fixtures.ts';
import { actionPhaseGame, GREEN, startedGame } from './game-flow.ts';

const NOWHERE = systemId('nirgendwo');
const NO_PLANET = planetId('nirgendwo');
const RED_PRIME = planetId('red-prime');

const apply = (state: GameState, ...events: readonly GameEvent[]) =>
  events.reduce(evolveGame, state);

/**
 * Event Sourcing: Reducer prüfen nichts, sie wenden nur an. Verweist ein Event auf
 * etwas, das es im Zustand nicht gibt, bleibt dieser Teil unverändert (keine Ausnahme).
 */
describe('Reducer bei unbekannten Verweisen', () => {
  it('Systeme und Planeten, die es nicht gibt, bleiben unberührt', () => {
    const state = actionPhaseGame();
    const after = apply(
      state,
      {
        type: 'CommandTokensPlaced',
        system: NOWHERE,
        placements: [{ player: RED, source: 'tactic' }],
      },
      { type: 'CommandTokenReturned', player: RED, system: NOWHERE },
      {
        type: 'UnitsProduced',
        player: RED,
        system: NOWHERE,
        space: [],
        planet: NO_PLANET,
        ground: [],
      },
      {
        type: 'StructuresPlaced',
        player: RED,
        placements: [{ planet: NO_PLANET, unit: unit(T.dock) }],
      },
      { type: 'PlanetControlGained', player: RED, planet: NO_PLANET, structuresDestroyed: [] },
      {
        type: 'GroundForcesCommitted',
        player: RED,
        planet: NO_PLANET,
        landings: [{ unit: unitId('x'), planet: NO_PLANET }],
      } as unknown as GameEvent,
    );
    expect(after.systems).toEqual(state.systems);
    expect(after.planets).toEqual(state.planets);
    expect(after.players).toEqual(state.players);
  });

  it('ohne Aktionsphase, Taktikaktion, Kampf oder offene Sekundärfähigkeit ändert sich der Zug nicht', () => {
    const started = startedGame();
    const passed = apply(started, { type: 'PlayerPassed', player: RED });
    expect(passed.actionPhase).toBeNull();
    const activated = apply(started, { type: 'SystemActivated', player: RED, system: NOWHERE });
    expect(activated.actionPhase).toBeNull();
    const state = actionPhaseGame();
    const untouched = apply(
      state,
      { type: 'SecondaryCostWaived', players: [GREEN] },
      { type: 'SecondaryDeclined', player: GREEN },
      { type: 'TacticalStepReached', step: 'done' } as unknown as GameEvent,
      { type: 'SpaceCombatEnded', system: NOWHERE } as unknown as GameEvent,
    );
    expect(untouched.actionPhase).toEqual(state.actionPhase);
    const tactical = apply(state, { type: 'SystemActivated', player: RED, system: NOWHERE });
    const noCombat = apply(tactical, {
      type: 'SpaceCombatRoundStarted',
      system: NOWHERE,
      round: 2,
    } as unknown as GameEvent);
    expect(noCombat.actionPhase?.tactical?.combat).toBeNull();
  });

  it('unbekannte Karten und eine leere Zugreihenfolge', () => {
    const state = actionPhaseGame();
    const performed = apply(state, {
      type: 'StrategicActionPerformed',
      player: RED,
      card: CARD(99),
      secondaryOrder: [],
    } as unknown as GameEvent);
    expect(performed.strategyCards).toEqual(state.strategyCards);
    const empty = apply(state, { type: 'ActionPhaseStarted', order: [] } as unknown as GameEvent);
    expect(empty.actionPhase?.active).toBeNull();
  });

  it('Bodenkampf beschädigt nur die getroffenen Einheiten', () => {
    const state = actionPhaseGame();
    const [hit, spared] = state.planets[RED_PRIME]?.units ?? [];
    const after = apply(state, {
      type: 'GroundCombatRoundRolled',
      planet: RED_PRIME,
      round: 1,
      volleys: [],
      sustained: [hit?.id as never],
      destroyed: [],
    });
    const units = after.planets[RED_PRIME]?.units ?? [];
    expect(units.find((u) => u.id === hit?.id)?.damaged).toBe(true);
    expect(units.find((u) => u.id === spared?.id)?.damaged).toBe(false);
  });
});
