// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { agendaId, type GameState, type PlayerId } from '@stellar/domain';
import type { ReactElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { LawsPanel } from '../src/components/agenda/LawsPanel.tsx';
import { TurnPanel } from '../src/components/game/TurnPanel.tsx';
import { useGameStore } from '../src/game-store.ts';
import { currentActor } from '../src/local-game.ts';
import { useGalaxyStore } from '../src/store.ts';
import { pickAll, started } from './game-helpers.ts';

afterEach(cleanup);

const store = () => useGameStore.getState();
const game = () => store().game as GameState;
const actor = () => currentActor(game()) as PlayerId;

function LiveSidebar(): ReactElement | null {
  const current = useGameStore((state) => state.game);
  if (current === null) return null;
  return (
    <>
      <TurnPanel game={current} />
      <LawsPanel game={current} />
    </>
  );
}

/** Zentrumsmarker entfernt, Statusphase im Store abgeschlossen: die Agendaphase läuft. */
function agendaPhase(deck: readonly string[]): void {
  useGalaxyStore.setState({ language: 'de' });
  const state = pickAll(started());
  const strategyCards = Object.fromEntries(
    Object.entries(state.strategyCards).map(([id, card]) => [id, { ...card, exhausted: true }]),
  );
  const agendaDeck = { deck: deck.map(agendaId), discard: [] };
  useGameStore.setState({
    game: { ...state, strategyCards, centerTokenRemoved: true, agendaDeck },
  });
  while (game().phase === 'action') store().send({ type: 'Pass', issuedBy: actor() });
  for (const player of game().players) store().send({ type: 'EndScoring', issuedBy: player.id });
  while (game().phase === 'status') {
    const pools = game().players.find((player) => player.id === actor())?.commandPools;
    const current = pools ?? { tactic: 0, fleet: 0, strategy: 0 };
    const allocation = { ...current, tactic: current.tactic + 2 };
    store().send({ type: 'AllocateCommandTokens', issuedBy: actor(), pools: allocation });
  }
}

describe('Agendaphase im Browser (RR 2)', () => {
  it('RR 2.6: Planeten wählen, Stimmen zählen, die Mehrheit entscheidet', () => {
    agendaPhase(['stimulus-package', 'council-seat']);
    expect(store().error).toBeNull();
    expect(game().phase).toBe('agenda');
    render(<LiveSidebar />);
    expect(screen.getByRole('heading', { name: 'Konjunkturpaket' })).toBeTruthy();
    expect(screen.getByText('Geltende Gesetze')).toBeTruthy();
    fireEvent.click(screen.getAllByRole('checkbox')[0] as HTMLElement);
    expect(Number(screen.getByTestId('vote-total').textContent)).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'Abstimmen' }));
    expect(store().error).toBeNull();
    expect(screen.getByTestId('tally-for')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Enthalten' }));
    fireEvent.click(screen.getByRole('button', { name: 'Enthalten' }));
    expect(store().error).toBeNull();
    expect(game().players.every((player) => player.tradeGoods >= 2)).toBe(true);
    expect(screen.getByRole('heading', { name: 'Ratssitz' })).toBeTruthy();
  });

  it('RR 2.19: enthalten sich alle, entscheidet der Sprecher; danach beginnt Runde 2', () => {
    agendaPhase(['council-seat']);
    render(<LiveSidebar />);
    for (let player = 0; player < 3; player += 1)
      fireEvent.click(screen.getByRole('button', { name: 'Enthalten' }));
    expect(actor()).toBe(game().speaker);
    expect(screen.getByText('Gleichstand: der Sprecher entscheidet')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Entscheiden' }));
    expect(store().error).toBeNull();
    expect(game()).toMatchObject({ phase: 'strategy', round: 2 });
    expect(game().laws).toHaveLength(1);
    expect(screen.getByText('Ratssitz')).toBeTruthy();
  });
});
