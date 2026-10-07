// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  adjacentSystemIds,
  type GameState,
  type PlayerId,
  type SystemId,
  unitId,
  unitTypeId,
} from '@stellar/domain';
import type { ReactElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { homeSystemOf } from '../src/card-view.ts';
import { CombatView } from '../src/components/combat/CombatView.tsx';
import { TacticalTurn } from '../src/components/game/TacticalPanel.tsx';
import { useGameStore } from '../src/game-store.ts';
import { content, useGalaxyStore } from '../src/store.ts';
import { cargoAtOrigin, movementChoices } from '../src/tactical-view.ts';
import { pickAll, started } from './game-helpers.ts';

afterEach(cleanup);

const store = () => useGameStore.getState();
const game = () => store().game as GameState;

/** Liest den Spielstand aus dem Store, damit das Panel jedem Schritt folgt. */
function LiveTurn({ player }: { readonly player: PlayerId }): ReactElement | null {
  const current = useGameStore((state) => state.game);
  return current === null ? null : <TacticalTurn game={current} player={player} />;
}

function begin(): { readonly player: PlayerId; readonly home: SystemId } {
  useGalaxyStore.setState({ language: 'de' });
  const state = pickAll(started());
  const player = state.actionPhase?.active as PlayerId;
  const home = homeSystemOf(state, player, content);
  if (home === null) throw new Error('keine Heimat');
  return { player, home };
}

const stepOf = () => game().actionPhase?.tactical?.step;

/** Ein Nachbarsystem der Heimat mit freiem Planeten und ohne Anomalie. */
function freeWorldNear(home: SystemId): SystemId {
  const state = game();
  const origin = state.systems[home];
  if (origin === undefined) throw new Error('keine Heimat');
  const target = adjacentSystemIds(state.systems, origin).find((id) => {
    const system = state.systems[id];
    return (
      system?.anomaly === undefined &&
      system?.planetIds.some((planet) => state.planets[planet]?.controller === null) === true
    );
  });
  if (target === undefined) throw new Error('kein freier Planet');
  return target;
}

describe('Produktion im Taktikpanel (RR 62)', () => {
  it('ohne Bewegung weiter, dann zwei Jäger mit einem Planeten bezahlen', () => {
    const { player, home } = begin();
    store().send({ type: 'ActivateSystem', issuedBy: player, system: home });
    render(<LiveTurn player={player} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ohne Bewegung weiter' }));
    expect(stepOf()).toBe('production');
    const fighters = () =>
      game().systems[home]?.spaceUnits.filter((unit) => unit.type === unitTypeId('fighter'))
        .length ?? 0;
    const before = fighters();
    fireEvent.click(screen.getByRole('button', { name: 'Jäger +' }));
    fireEvent.click(screen.getByRole('button', { name: 'Jäger +' }));
    expect(screen.getByTestId('production-cost').textContent).toBe('1');
    fireEvent.click(screen.getAllByRole('checkbox')[0] as HTMLElement);
    fireEvent.click(screen.getByRole('button', { name: 'Produzieren' }));
    expect(store().error).toBeNull();
    expect(fighters()).toBe(before + 2);
    expect(stepOf()).toBe('done');
  });
});

describe('Einmarsch im Taktikpanel (RR 25)', () => {
  it('ein Träger bringt Infanterie zu einem freien Planeten, sie landet und übernimmt ihn', () => {
    const { player, home } = begin();
    const target = freeWorldNear(home);
    store().send({ type: 'ActivateSystem', issuedBy: player, system: target });
    const carrier = movementChoices(game(), content).find(
      (option) => option.ship.type === unitTypeId('carrier') && option.from === home,
    );
    if (carrier === undefined) throw new Error('kein Träger');
    const infantry = cargoAtOrigin(game(), content, carrier, player)
      .filter((unit) => unit.type === unitTypeId('infantry'))
      .slice(0, 2)
      .map((unit) => unit.id);
    const move = { ship: carrier.ship.id, path: carrier.path, cargo: infantry };
    store().send({ type: 'MoveShips', issuedBy: player, moves: [move] });
    expect(stepOf()).toBe('invasion');
    render(<LiveTurn player={player} />);
    const [first] = screen.getAllByRole('combobox');
    const planet = game().systems[target]?.planetIds[0] as string;
    fireEvent.change(first as HTMLElement, { target: { value: planet } });
    fireEvent.click(screen.getByRole('button', { name: 'Landen' }));
    expect(store().error).toBeNull();
    expect(game().planets[planet]?.controller).toBe(player);
    expect(store().combatLog.map((event) => event.type)).toEqual([
      'GroundForcesCommitted',
      'PlanetControlGained',
    ]);
  });
});

describe('Bombardement im Taktikpanel (RR 20)', () => {
  it('ein Schlachtschiff bombardiert einen fremden Planeten; die Kampfansicht zeigt den Wurf', () => {
    const { player, home } = begin();
    const target = freeWorldNear(home);
    const state = game();
    const enemy = state.players.find((p) => p.id !== player)?.id as PlayerId;
    const planet = state.systems[target]?.planetIds[0] as string;
    const battleship = {
      id: unitId('bs'),
      type: unitTypeId('dreadnought'),
      owner: player,
      damaged: false,
    };
    const defender = {
      id: unitId('inf'),
      type: unitTypeId('infantry'),
      owner: enemy,
      damaged: false,
    };
    const system = state.systems[target] as GameState['systems'][string];
    const world = state.planets[planet] as GameState['planets'][string];
    const tactical = {
      system: target,
      step: 'bombardment',
      pendingHits: [],
      combat: null,
      windows: [],
      bonuses: [],
    } as const;
    useGameStore.setState({
      combatLog: [],
      combatOpen: false,
      game: {
        ...state,
        systems: { ...state.systems, [target]: { ...system, spaceUnits: [battleship] } },
        planets: { ...state.planets, [planet]: { ...world, controller: enemy, units: [defender] } },
        actionPhase: state.actionPhase === null ? null : { ...state.actionPhase, tactical },
      },
    });
    render(<LiveTurn player={player} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: planet } });
    fireEvent.click(screen.getByRole('button', { name: 'Bombardieren' }));
    expect(store().error).toBeNull();
    expect(store().combatLog[0]?.type).toBe('BombardmentRolled');
    expect(store().combatOpen).toBe(true);
    cleanup();
    render(<CombatView />);
    expect(screen.getByRole('dialog', { name: 'Einmarsch' })).toBeDefined();
  });
});
