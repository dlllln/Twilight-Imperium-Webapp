// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { currentActor, type GameState } from '@stellar/domain';
import type { ReactElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { involvesHuman } from '../src/combat-view.ts';
import { TurnPanel } from '../src/components/game/TurnPanel.tsx';
import { Toolbar } from '../src/components/Toolbar.tsx';
import { useGameStore } from '../src/game-store.ts';
import { botSeats, seatPlayerId } from '../src/local-game.ts';
import { useGalaxyStore } from '../src/store.ts';
import { useBotDriver } from '../src/use-bot-driver.ts';
import { threePlayerLayout } from './game-helpers.ts';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const store = () => useGameStore.getState();
const game = () => store().game as GameState;
const HUMAN = seatPlayerId(0);

/** Drei Plätze, zwei davon KI; der Mensch behält seine geheimen Aufträge. */
function botGame(): void {
  useGalaxyStore.setState({ language: 'de' });
  store().start(threePlayerLayout(), 3, 7, 2);
  const choice = game().players.find((player) => player.id === HUMAN)?.secretChoice;
  const keep = choice?.options.slice(0, choice.keep) ?? [];
  store().send({ type: 'KeepSecretObjectives', issuedBy: HUMAN, keep });
}

/** Lässt die KI ziehen, bis wieder der Mensch entscheiden muss. */
function runBots(limit = 200): number {
  let steps = 0;
  while (steps < limit && store().botStep()) steps += 1;
  return steps;
}

function Driven(): ReactElement | null {
  useBotDriver(10);
  const current = useGameStore((state) => state.game);
  return current === null ? null : <TurnPanel game={current} />;
}

describe('KI-Gegner im Hot-Seat', () => {
  it('die KI übernimmt die letzten Plätze, der Gastgeber bleibt ein Mensch', () => {
    expect(botSeats(4, 2)).toEqual([seatPlayerId(2), seatPlayerId(3)]);
    expect(botSeats(3, 5)).toEqual([seatPlayerId(1), seatPlayerId(2)]);
    botGame();
    expect(store().bots).toEqual([seatPlayerId(1), seatPlayerId(2)]);
    expect(game().players.map((player) => player.name)).toEqual(['P1', 'KI2', 'KI3']);
  });

  it('die KI zieht über dieselben Regeln, bis der Mensch wieder dran ist', () => {
    botGame();
    expect(runBots()).toBeGreaterThan(0);
    expect(store().error).toBeNull();
    expect(game().players.every((player) => player.secretChoice === null)).toBe(true);
    expect(currentActor(game())).toBe(HUMAN);
    expect(store().botStep()).toBe(false);
  });

  it('während die KI zieht, zeigt das Zugfeld nur einen Hinweis; der Treiber zieht selbst', () => {
    vi.useFakeTimers();
    botGame();
    render(<Driven />);
    expect(screen.getByText('ist am Zug und überlegt …')).toBeTruthy();
    for (let tick = 0; tick < 50 && currentActor(game()) !== HUMAN; tick += 1)
      act(() => {
        vi.advanceTimersByTime(20);
      });
    expect(currentActor(game())).toBe(HUMAN);
    expect(screen.queryByText('ist am Zug und überlegt …')).toBeNull();
  });

  it('Kämpfe nur zwischen KI-Gegnern öffnen keine Kampfansicht', () => {
    botGame();
    const bots = store().bots;
    const fired = [
      {
        type: 'SpaceCombatStarted',
        system: 'x',
        attacker: seatPlayerId(1),
        defender: seatPlayerId(2),
      },
    ] as never;
    const turn = { ...game(), actionPhase: null };
    expect(involvesHuman(turn, fired, bots)).toBe(false);
    expect(involvesHuman(turn, fired, [])).toBe(true);
  });

  it('in der Leiste wählt man die Zahl der KI-Gegner, höchstens alle außer dem Gastgeber', () => {
    useGalaxyStore.setState({ language: 'de', playerCount: 3, botCount: 0 });
    useGameStore.setState({ game: null });
    render(<Toolbar />);
    fireEvent.change(screen.getByLabelText('KI-Gegner'), { target: { value: '2' } });
    expect(useGalaxyStore.getState().botCount).toBe(2);
    useGalaxyStore.getState().setBotCount(9);
    expect(useGalaxyStore.getState().botCount).toBe(2);
  });
});
