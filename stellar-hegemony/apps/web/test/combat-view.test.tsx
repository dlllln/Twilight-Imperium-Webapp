// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  actionCardId,
  adjacentSystemIds,
  type GameEvent,
  type GameState,
  type PlayerId,
  unitId,
  unitTypeId,
} from '@stellar/domain';
import { afterEach, describe, expect, it } from 'vitest';
import { CombatView } from '../src/components/combat/CombatView.tsx';
import { combatDecision, combatParties, nextCombatLog, opensCombat } from '../src/combat-view.ts';
import { useGameStore } from '../src/game-store.ts';
import { currentActor } from '@stellar/domain';
import { content, useGalaxyStore } from '../src/store.ts';
import { movementChoices } from '../src/tactical-view.ts';
import { pickAll, started } from './game-helpers.ts';

afterEach(cleanup);

const store = () => useGameStore.getState();
const game = () => store().game as GameState;

/** Heimatsystem des aktiven Spielers und ein freies Nachbarsystem ohne Anomalie. */
function frontier(state: GameState, player: PlayerId) {
  const home = Object.values(state.systems).find((system) =>
    system.spaceUnits.some((unit) => unit.owner === player),
  );
  if (home === undefined) throw new Error('keine Heimat');
  const free = adjacentSystemIds(state.systems, home).find((id) => {
    const system = state.systems[id];
    return system?.anomaly === undefined && system?.spaceUnits.length === 0;
  });
  if (free === undefined) throw new Error('kein Nachbar');
  return free;
}

/** Legt einen gegnerischen Kreuzer neben die Heimat des aktiven Spielers und greift an. */
function attackNeighbour(cards: readonly string[] = []): {
  readonly attacker: PlayerId;
  readonly defender: PlayerId;
} {
  const picked = pickAll(started());
  const players = picked.players.map((player) =>
    player.id === picked.actionPhase?.active
      ? { ...player, actionCards: cards.map(actionCardId) }
      : player,
  );
  const state = { ...picked, players };
  const attacker = state.actionPhase?.active as PlayerId;
  const defender = state.players.find((player) => player.id !== attacker)?.id as PlayerId;
  const target = frontier(state, attacker);
  const enemy = {
    id: unitId('feind'),
    type: unitTypeId('cruiser'),
    owner: defender,
    damaged: false,
  };
  const system = state.systems[target];
  const systems = { ...state.systems, [target]: { ...system, spaceUnits: [enemy] } };
  useGameStore.setState({
    game: { ...state, systems } as GameState,
    combatLog: [],
    combatOpen: false,
  });
  store().send({ type: 'ActivateSystem', issuedBy: attacker, system: target });
  const moves = movementChoices(game(), content).map(({ ship, path }) => ({
    ship: ship.id,
    path,
    cargo: [],
  }));
  store().send({ type: 'MoveShips', issuedBy: attacker, moves });
  return { attacker, defender };
}

/** Entscheidet, bis der Kampf vorbei ist: Vorschläge annehmen, nie zurückziehen. */
function resolveCombat(): void {
  for (let guard = 0; guard < 50; guard += 1) {
    const decision = combatDecision(game(), content);
    if (decision === null) return;
    const { player } = decision;
    if (decision.kind === 'hits')
      store().send({ type: 'AssignHits', issuedBy: player, ...decision.suggestion });
    else store().send({ type: 'DeclareRetreat', issuedBy: player, to: null });
  }
}

describe('Kampfprotokoll', () => {
  const cannon = {
    type: 'SpaceCannonFired',
    system: 'b',
    volley: { player: 'p2', target: 'p1', rolls: [], hits: 0 },
  } as unknown as GameEvent;
  const assigned = {
    type: 'HitsAssigned',
    player: 'p1',
    system: 'b',
    sustained: [],
    destroyed: [],
  } as unknown as GameEvent;
  const riftLoss = { type: 'UnitsDestroyed', system: 'b', units: [] } as unknown as GameEvent;

  it('beginnt mit Kanonenfeuer oder Kampfbeginn und wird bei neuer Aktivierung geleert', () => {
    expect(nextCombatLog([], [riftLoss, assigned])).toEqual([]);
    const log = nextCombatLog([], [cannon, assigned, riftLoss]);
    expect(log).toHaveLength(3);
    const activated = {
      type: 'SystemActivated',
      player: 'p1',
      system: 'c',
    } as unknown as GameEvent;
    expect(nextCombatLog(log, [activated])).toEqual([]);
    expect(opensCombat([assigned])).toBe(false);
    expect(opensCombat([cannon])).toBe(true);
  });
});

describe('Kampfansicht', () => {
  it('RR 63: ein Angriff öffnet die Kampfansicht mit beiden Seiten und Würfeln', () => {
    useGalaxyStore.setState({ language: 'de' });
    const { attacker, defender } = attackNeighbour();
    expect(store().combatOpen).toBe(true);
    expect(store().combatLog.some((event) => event.type === 'SpaceCombatStarted')).toBe(true);
    expect(combatParties(game(), store().combatLog)).toEqual([attacker, defender]);
    render(<CombatView />);
    expect(screen.getByRole('dialog', { name: 'Raumkampf' })).toBeDefined();
    expect(screen.getByText('Angreifer')).toBeDefined();
    expect(screen.getByText('Verteidiger')).toBeDefined();
    expect(document.querySelector('.combat-stage .battle-canvas')).not.toBeNull();
    // RR 63.5: Der Angreifer kann sich in seine Heimat zurückziehen, also fragt die Ansicht zuerst.
    expect(document.querySelectorAll('.die')).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Weiterkämpfen' }));
    expect(document.querySelectorAll('.die').length).toBeGreaterThan(0);
  });

  it('nach allen Entscheidungen steht das Ergebnis da und die Ansicht lässt sich schließen', () => {
    useGalaxyStore.setState({ language: 'de' });
    const { attacker } = attackNeighbour();
    resolveCombat();
    expect(game().actionPhase?.tactical?.step).toBe('done');
    expect(currentActor(game())).toBe(attacker);
    render(<CombatView />);
    expect(document.querySelector('.combat-result')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Kampfansicht schließen' }));
    expect(store().combatOpen).toBe(false);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('Aktionskarten in der Kampfansicht (RR 3.10)', () => {
  it('vor der Kampfrunde fragt die Ansicht nach Karten; der Bonus steht im Protokoll', () => {
    useGalaxyStore.setState({ language: 'de' });
    const { attacker } = attackNeighbour(['combat-drill']);
    store().send({ type: 'DeclareRetreat', issuedBy: attacker, to: null });
    expect(game().reactionWindow?.kind).toBe('combatRound');
    const { rerender } = render(<CombatView />);
    fireEvent.click(screen.getByRole('button', { name: 'Ausspielen' }));
    expect(store().error).toBeNull();
    rerender(<CombatView />);
    fireEvent.click(screen.getByRole('button', { name: 'Keine Karte spielen' }));
    expect(store().error).toBeNull();
    expect(game().reactionWindow).toBeNull();
    expect(document.querySelector('.card-log')?.textContent).toContain('+1');
  });
});
