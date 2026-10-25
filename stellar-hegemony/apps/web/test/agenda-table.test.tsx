// @vitest-environment jsdom
import { agendaId, currentActor, type GameState, type PlayerId } from '@stellar/domain';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { NoticeStack } from '../src/components/hud/NoticeStack.tsx';
import { PlayerSheet } from '../src/components/sheet/PlayerSheet.tsx';
import { AgendaTable } from '../src/components/table/AgendaTable.tsx';
import { useGameStore } from '../src/game-store.ts';
import { useSettingsStore } from '../src/settings-store.ts';
import { useGalaxyStore } from '../src/store.ts';
import { useCarryStore } from '../src/table/carry-store.ts';
import { useDraftStore } from '../src/table/draft-store.ts';
import { pickAll, started } from './game-helpers.ts';
import { leaveTable, seatTable } from './local-table.ts';

/*
 * Agendatisch (Tischansicht): Die Agenda liegt aufgedeckt in der Mitte, darunter je Ergebnis
 * eine Platte. Abstimmen heißt Platte antippen und Planeten der Planetenreihe; ihre Stimmen
 * stapeln sich auf der Platte, das Siegel gibt sie ab. Bei Gleichstand leuchten die gleichauf
 * liegenden Platten, der Sprecher tippt eine an und entscheidet.
 */

const store = () => useGameStore.getState();
const game = () => store().game as GameState;
const actor = () => currentActor(game()) as PlayerId;
const table = () => screen.getByRole('region', { name: 'Agendatisch' });
const plate = (outcome: string) =>
  table().querySelector(`.outcome-plate[data-outcome="${outcome}"]`) as HTMLElement;
const row = () => screen.getByRole('region', { name: 'Deine Planeten' });
const EMPTY = { piece: null, legal: new Set<string>(), over: null, point: null, mode: null };

beforeEach(() => {
  leaveTable();
  useGalaxyStore.setState({ language: 'de' });
  useSettingsStore.setState({ animations: false, tableView: true });
  useCarryStore.setState({ ...EMPTY, news: null });
  useDraftStore.getState().clear();
});

afterEach(cleanup);

function Live(): ReactElement | null {
  const current = useGameStore((state) => state.game);
  if (current === null) return null;
  return (
    <>
      <PlayerSheet game={current} />
      <NoticeStack game={current} />
      <AgendaTable game={current} />
    </>
  );
}

/** Zentrumsmarker entfernt, Statusphase abgeschlossen: die Agendaphase läuft. */
function agendaPhase(deck: readonly string[]): void {
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
    store().send({
      type: 'AllocateCommandTokens',
      issuedBy: actor(),
      pools: { ...current, tactic: current.tactic + 2 },
    });
  }
}

const confirm = () => fireEvent.click(screen.getByTestId('confirm'));

describe('Agendatisch: abstimmen auf den Platten', () => {
  it('Platte und Planeten antippen; die Stimmen stapeln sich und das Siegel gibt sie ab', () => {
    agendaPhase(['stimulus-package', 'council-seat']);
    seatTable(game());
    render(<Live />);
    expect(within(table()).getByRole('heading', { name: 'Konjunkturpaket' })).toBeTruthy();
    expect(screen.getByTestId('confirm').hasAttribute('disabled')).toBe(true);
    fireEvent.click(plate('for'));
    expect(plate('for').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTestId('vote-outcome').textContent).toContain('Dafür');
    const card = row().querySelector('[data-target^="planet:"]');
    if (!(card instanceof HTMLElement)) throw new Error('kein Planet');
    fireEvent.click(card);
    const total = Number(screen.getByTestId('vote-total').textContent);
    expect(total).toBeGreaterThan(0);
    expect(within(plate('for')).getByTestId('plate-pending').children).toHaveLength(1);
    confirm();
    expect(store().error).toBeNull();
    expect(screen.getByTestId('plate-votes-for').textContent).toBe(`${String(total)} Stimmen`);
  });

  it('wer nicht abstimmt, sieht die Platten ohne Knöpfe; Enthalten und Dagegen führen zur nächsten Agenda', () => {
    agendaPhase(['stimulus-package', 'council-seat']);
    const voter = actor();
    const other = game().players.find((player) => player.id !== voter)?.id as PlayerId;
    seatTable(game(), { me: other });
    render(<Live />);
    expect(plate('for').tagName).toBe('DIV');
    cleanup();
    seatTable(game());
    render(<Live />);
    fireEvent.click(screen.getByRole('button', { name: 'Enthalten' }));
    fireEvent.click(plate('against'));
    fireEvent.click(row().querySelector('[data-target^="planet:"]') as HTMLElement);
    confirm();
    fireEvent.click(screen.getByRole('button', { name: 'Enthalten' }));
    expect(store().error).toBeNull();
    expect(within(table()).getByRole('heading', { name: 'Ratssitz' })).toBeTruthy();
  });
});

describe('Agendatisch: Gleichstand', () => {
  it('die gleichauf liegenden Platten leuchten; der Sprecher tippt eine an und entscheidet', () => {
    agendaPhase(['council-seat']);
    seatTable(game());
    render(<Live />);
    for (let vote = 0; vote < 3; vote += 1)
      fireEvent.click(screen.getByRole('button', { name: 'Enthalten' }));
    expect(actor()).toBe(game().speaker);
    const tied = table().querySelectorAll('.outcome-plate[data-tied="true"]');
    expect(tied.length).toBeGreaterThan(1);
    const chosen = tied[1] as HTMLElement;
    fireEvent.click(chosen);
    expect(chosen.getAttribute('aria-pressed')).toBe('true');
    const name = chosen.querySelector('.plate-name')?.textContent ?? '';
    expect(screen.getByTestId('tie-outcome').textContent).toContain(name);
    confirm();
    expect(store().error).toBeNull();
    expect(game()).toMatchObject({ phase: 'strategy', round: 2 });
    expect(game().laws[0]?.owner).toBe(chosen.getAttribute('data-outcome'));
  });
});
