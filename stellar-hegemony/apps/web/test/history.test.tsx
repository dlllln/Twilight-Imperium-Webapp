// @vitest-environment jsdom
import { seatPlayerId } from '@stellar/application';
import { currentActor, type GameEvent, type GameState, type PlayerId } from '@stellar/domain';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { involvesHuman } from '../src/combat-view.ts';
import { TurnPanel } from '../src/components/game/TurnPanel.tsx';
import { HistoryPanel } from '../src/components/history/HistoryPanel.tsx';
import { PhaseDock } from '../src/components/hud/PhaseDock.tsx';
import { useGameStore } from '../src/game-store.ts';
import { appendHistory, HISTORY_LIMIT, historyLines } from '../src/history/turn-history.ts';
import { useSettingsStore } from '../src/settings-store.ts';
import { useGalaxyStore } from '../src/store.ts';
import { keepSecrets, pickAll, started } from './game-helpers.ts';
import { leaveTable, seatTable } from './local-table.ts';

beforeEach(() => {
  useGalaxyStore.setState({ language: 'de' });
  useSettingsStore.setState({ animations: false });
  leaveTable();
});

afterEach(cleanup);

const store = () => useGameStore.getState();
const game = () => store().game as GameState;
const P1 = seatPlayerId(0);
const P2 = seatPlayerId(1);

const homeOf = (state: GameState, player: PlayerId) =>
  Object.values(state.systems).find((system) =>
    system.spaceUnits.some((unit) => unit.owner === player),
  );

/** Phase, Verlauf und Zugfeld, die dem Spielstand folgen. */
function Live(): ReactElement | null {
  const current = useGameStore((state) => state.game);
  if (current === null) return null;
  return (
    <>
      <PhaseDock game={current} />
      <HistoryPanel game={current} />
    </>
  );
}

describe('Zugverlauf „Was ist passiert?“', () => {
  it('erzählt Aktivieren, Bewegen und Erobern; Würfe und Zwischenschritte bleiben weg', () => {
    const events = [
      { type: 'StrategyPhaseStarted', round: 2, pickQueue: [] },
      { type: 'SystemActivated', player: P1, system: 'b07' },
      { type: 'TacticalStepReached', step: 'movement' },
      { type: 'ShipsMoved', player: P1, system: 'b07', movements: [{}, {}] },
      { type: 'GravityRiftRolled', player: P1, ship: 'x', roll: 3, destroyed: false },
      { type: 'PlanetControlGained', player: P1, planet: 'p', structuresDestroyed: [] },
      { type: 'UnitsDeployed', player: P1, ability: 'beachhead', planet: 'p', units: [{}] },
    ] as unknown as GameEvent[];
    expect(historyLines(events).map((line) => line.kind)).toEqual([
      'round',
      'activated',
      'moved',
      'conquered',
      'deployed',
    ]);
    expect(historyLines(events)[4]).toMatchObject({ planet: 'p', count: 1 });
    expect(historyLines(events)[2]).toMatchObject({ count: 2, system: 'b07' });
  });

  it('nummeriert fortlaufend und behält nur die letzten Zeilen', () => {
    const passed = { type: 'PlayerPassed', player: P1 } as GameEvent;
    const once = appendHistory([], [passed, passed]);
    expect(once.map((entry) => entry.id)).toEqual([1, 2]);
    expect(appendHistory(once, [])).toBe(once);
    const many = appendHistory(
      once,
      Array.from({ length: HISTORY_LIMIT }, () => passed),
    );
    expect(many).toHaveLength(HISTORY_LIMIT);
    expect(many.at(-1)?.id).toBe(HISTORY_LIMIT + 2);
  });

  it('zeigt das Neueste oben, mit Namen der Spieler und der gewählten Sprache', () => {
    seatTable(keepSecrets(started()));
    render(<Live />);
    expect(screen.getByText('Noch ist nichts passiert.')).toBeTruthy();
    const card = Object.values(game().strategyCards).sort((a, b) => a.initiative - b.initiative)[0];
    const actor = currentActor(game()) as PlayerId;
    act(() => {
      store().send({ type: 'PickStrategyCard', issuedBy: actor, card: card?.id as never });
    });
    const lines = screen.getAllByRole('listitem').map((item) => item.textContent);
    expect(lines[0]).toMatch(/wählt Führung$/);
  });
});

describe('Rückgängig im Browser', () => {
  it('der Knopf erscheint nach einem zurücknehmbaren eigenen Schritt und nimmt ihn zurück', () => {
    const before = pickAll(started());
    const actor = currentActor(before) as PlayerId;
    const home = homeOf(before, actor);
    if (home === undefined) throw new Error('kein Heimatsystem');
    render(<Live />);
    expect(screen.queryByRole('button', { name: 'Rückgängig' })).toBeNull();
    act(() => {
      store().send({ type: 'ActivateSystem', issuedBy: actor, system: home.id });
    });
    expect(game().actionPhase?.tactical).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Rückgängig' }));
    expect(game().actionPhase?.tactical).toBeNull();
    expect(screen.queryByRole('button', { name: 'Rückgängig' })).toBeNull();
    expect(screen.getAllByRole('listitem')[0]?.textContent).toMatch(
      /nimmt den letzten Schritt zurück$/,
    );
  });

  it('endgültige Schritte lassen sich nicht zurücknehmen', () => {
    const before = pickAll(started());
    const actor = currentActor(before) as PlayerId;
    render(<Live />);
    act(() => {
      store().send({ type: 'Pass', issuedBy: actor });
    });
    expect(store().undoVersion).toBeNull();
    expect(screen.queryByRole('button', { name: 'Rückgängig' })).toBeNull();
  });
});

describe('Mitspieler und KI an anderen Geräten', () => {
  it('zieht die KI, zeigt das Zugfeld nur einen Hinweis; Menschen erscheinen als „ist am Zug“', () => {
    const state = keepSecrets(started());
    const actor = currentActor(state) as PlayerId;
    const me = state.players.find((player) => player.id !== actor)?.id ?? P1;
    seatTable(state, { me });
    useGameStore.setState({ bots: [actor] });
    const { rerender } = render(<TurnPanel game={state} />);
    expect(screen.getByText('ist am Zug und überlegt …')).toBeTruthy();
    useGameStore.setState({ bots: [] });
    rerender(<TurnPanel game={state} />);
    expect(screen.getByText('ist am Zug …')).toBeTruthy();
  });

  it('Kämpfe ohne den eigenen Platz öffnen keine Kampfansicht; ohne Partie geht nichts raus', () => {
    const fired = [{ type: 'SpaceCombatStarted', system: 'x', attacker: P2, defender: P1 }];
    const turn = { ...started(), actionPhase: null };
    expect(involvesHuman(turn, fired as never, [P1, P2])).toBe(false);
    expect(involvesHuman(turn, fired as never, [P2])).toBe(true);
    leaveTable();
    expect(store().send({ type: 'Pass', issuedBy: P1 })).toBe(false);
  });
});
