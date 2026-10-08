// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import {
  actionCardId,
  findPlayer,
  type GameState,
  type PlayerId,
  type PlayerState,
} from '@stellar/domain';
import type { ReactElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { HandDock } from '../src/components/hand/HandDock.tsx';
import { PlayersPanel } from '../src/components/game/PlayersPanel.tsx';
import { TurnPanel } from '../src/components/game/TurnPanel.tsx';
import { useGameStore } from '../src/game-store.ts';
import { currentActor } from '../src/local-game.ts';
import { useGalaxyStore } from '../src/store.ts';
import { pickAll, started } from './game-helpers.ts';

afterEach(cleanup);

const store = () => useGameStore.getState();
const game = () => store().game as GameState;
const player = (id: PlayerId) => findPlayer(game(), id) as PlayerState;

/** Seitenleiste mit Zug und die Hand am unteren Rand, beide folgen dem Spielstand. */
function LiveSidebar(): ReactElement | null {
  const current = useGameStore((state) => state.game);
  if (current === null) return null;
  return (
    <>
      <TurnPanel game={current} />
      <HandDock game={current} />
      <PlayersPanel game={current} />
    </>
  );
}

/** Aktionsphase; die Spieler bekommen die angegebenen Handkarten. */
function withHands(hands: readonly (readonly string[])[]) {
  useGalaxyStore.setState({ language: 'de' });
  const state = pickAll(started());
  const order = state.actionPhase?.order ?? [];
  const players = state.players.map((entry) => {
    const hand = hands[order.indexOf(entry.id)] ?? [];
    return { ...entry, actionCards: hand.map(actionCardId) };
  });
  useGameStore.setState({ game: { ...state, players }, error: null });
  const [active, next] = order as [PlayerId, PlayerId];
  render(<LiveSidebar />);
  return { active, next };
}

/** Eine Karte der Hand antippen. */
const tap = (card: string) => fireEvent.click(screen.getByTestId(`card-${card}`));

describe('Aktionskarten im Browser (RR 3)', () => {
  it('RR 51: eine Materialaktion wirkt und beendet den Zug', () => {
    const { active } = withHands([['black-market']]);
    const goods = player(active).tradeGoods;
    expect(screen.getByRole('region', { name: 'Deine Hand' }).textContent).toContain('Hand von');
    tap('black-market');
    expect(store().error).toBeNull();
    expect(player(active).tradeGoods).toBe(goods + 3);
    expect(player(active).actionCards).toHaveLength(0);
    expect(game().actionPhase?.active).not.toBe(active);
  });

  it('RR 3.6: Karten mit anderem Zeitpunkt liegen nur zur Ansicht auf der Hand', () => {
    withHands([['combat-drill']]);
    const card = screen.getByTestId('card-combat-drill');
    expect(card.className).toContain('idle');
    expect(card.getAttribute('aria-disabled')).toBe('true');
    tap('combat-drill');
    expect(player(game().actionPhase?.active as PlayerId).actionCards).toHaveLength(1);
  });

  it('RR 3.8: wer verhindern könnte, wird gefragt; ohne Einspruch wirkt die Karte', () => {
    const { active, next } = withHands([['black-market'], ['counterplay']]);
    tap('black-market');
    expect(currentActor(game())).toBe(next);
    expect(screen.getByText('hat eine Karte gespielt', { exact: false })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Nicht verhindern' }));
    expect(store().error).toBeNull();
    expect(player(active).tradeGoods).toBe(3);
  });

  it('RR 3.8: die verhinderte Karte bleibt ohne Wirkung', () => {
    const { active, next } = withHands([['black-market'], ['counterplay']]);
    tap('black-market');
    tap('counterplay');
    expect(store().error).toBeNull();
    expect(player(active).tradeGoods).toBe(0);
    expect(player(next).actionCards).toHaveLength(0);
    expect(game().pendingPlay).toBeNull();
  });

  it('Ziel wählen: der zusätzliche Kommandomarker kommt in den Flottenpool', () => {
    const { active } = withHands([['command-reserve']]);
    const fleet = player(active).commandPools.fleet;
    tap('command-reserve');
    const targets = screen.getByRole('dialog');
    fireEvent.change(within(targets).getByRole('combobox'), { target: { value: 'fleet' } });
    fireEvent.click(within(targets).getByRole('button', { name: 'Ausspielen' }));
    expect(store().error).toBeNull();
    expect(player(active).commandPools.fleet).toBe(fleet + 1);
  });

  it('RR 3.4: über dem Limit wird zuerst abgelegt', () => {
    const cards = Array.from({ length: 9 }, () => 'black-market');
    const { next } = withHands([[], cards]);
    expect(currentActor(game())).toBe(next);
    expect(screen.getByTestId(`hand-${next}`).textContent).toContain('9');
    const [first, second] = screen.getAllByRole('checkbox');
    fireEvent.click(first as HTMLElement);
    fireEvent.click(second as HTMLElement);
    fireEvent.click(screen.getByRole('button', { name: 'Ablegen' }));
    expect(store().error).toBeNull();
    expect(player(next).actionCards).toHaveLength(7);
    expect(game().actionDeck.discard).toHaveLength(2);
  });

  it('RR 3.10: im offenen Zeitfenster kann man ohne Karte weitergeben', () => {
    const { next } = withHands([[], ['mobilization']]);
    const reactionWindow = { kind: 'afterActivation' as const, awaiting: [next], played: [] };
    act(() => useGameStore.setState({ game: { ...game(), reactionWindow } }));
    expect(screen.getByText(/Ein System wurde aktiviert/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Keine Karte spielen' }));
    expect(store().error).toBeNull();
    expect(game().reactionWindow).toBeNull();
  });
});
