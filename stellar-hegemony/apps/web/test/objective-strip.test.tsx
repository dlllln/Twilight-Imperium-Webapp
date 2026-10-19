// @vitest-environment jsdom
import {
  findPlayer,
  type GameState,
  objectiveId,
  type PlayerId,
  updatePlayer,
} from '@stellar/domain';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { objectiveArtwork } from '../src/artwork/cards.ts';
import { ObjectiveStrip } from '../src/components/table/ObjectiveStrip.tsx';
import { useGameStore } from '../src/game-store.ts';
import { useHandStore } from '../src/hand/hand-store.ts';
import { objectiveStrip, scorableNow } from '../src/hud/objective-strip.ts';
import { objectiveLabel } from '../src/labels.ts';
import { seatColor } from '../src/seat-colors.ts';
import { useSettingsStore } from '../src/settings-store.ts';
import { content, useGalaxyStore } from '../src/store.ts';
import { useDraftStore } from '../src/table/draft-store.ts';
import { pickAll, started } from './game-helpers.ts';
import { leaveTable, seatTable } from './local-table.ts';

beforeEach(() => {
  leaveTable();
  useGalaxyStore.setState({ language: 'de' });
  useSettingsStore.setState({ animations: false, tableView: true });
  useHandStore.getState().clear();
  useDraftStore.getState().clear();
});

afterEach(cleanup);

const game = () => useGameStore.getState().game as GameState;
const strip = () => screen.getByRole('region', { name: 'Aufträge auf dem Tisch' });

function Live(): ReactElement | null {
  const current = useGameStore((state) => state.game);
  return current === null ? null : <ObjectiveStrip game={current} />;
}

/** Statusphase, Wertung: drei öffentliche Aufträge offen, der Erste der Reihe am Bildschirm. */
function scoringTable(): PlayerId {
  const state = pickAll(started());
  const order = state.players.map((player) => player.id);
  const me = order[0] as PlayerId;
  const statusPhase = { step: 'scoring', order, waiting: order, scored: {} } as const;
  const slots = ['merchant-reserve', 'war-chest', 'settled-reach'].map((id) => ({
    id: objectiveId(id),
    stage: 1,
    revealed: true,
  }));
  const objectives = { ...state.objectives, public: slots };
  const status = { ...state, phase: 'status', actionPhase: null, statusPhase, objectives } as const;
  seatTable(
    updatePlayer(status, me, (p) => ({ ...p, tradeGoods: 10 })),
    { me },
  );
  return me;
}

/** Jeder verdeckte Platz zeigt die Rückseite seiner Stufe und keine Punkte. */
function expectBacks(slots: readonly { readonly stage: number }[]): void {
  const hidden = strip().querySelectorAll('[data-revealed="false"]');
  expect(hidden).toHaveLength(slots.length);
  for (const [index, item] of [...hidden].entries()) {
    const stage = slots[index]?.stage ?? 1;
    expect(item.querySelector('img')?.getAttribute('src')).toBe(
      objectiveArtwork('public', stage).path,
    );
    expect(item.querySelector('.objective-strip-points')).toBeNull();
  }
}

describe('Auftragsleiste auf dem Tisch', () => {
  it('verdeckte Aufträge zeigen nur ihre Rückseite', () => {
    const state = pickAll(started());
    const me = state.actionPhase?.active as PlayerId;
    seatTable(state, { me });
    render(<Live />);
    const hiddenSlots = state.objectives.public.filter((slot) => !slot.revealed);
    expect(hiddenSlots.length).toBeGreaterThan(0);
    expectBacks(hiddenSlots);
    for (const slot of hiddenSlots)
      expect(strip().textContent).not.toContain(objectiveLabel(slot.id, 'de'));
    const cards = objectiveStrip(state, me, content);
    expect(cards.filter((card) => !card.revealed).every((card) => card.id === null)).toBe(true);
    const own = findPlayer(state, me)?.secretObjectives ?? [];
    expect(cards.filter((card) => card.category === 'secret').map((card) => card.id)).toEqual(own);
  });

  it('bei der Wertung sind nur erfüllte Aufträge wählbar', () => {
    scoringTable();
    render(<Live />);
    expect(strip().dataset['mode']).toBe('decision');
    expect(strip().dataset['expanded']).toBe('true');
    const buttons = within(strip()).getAllByRole('button', { pressed: false });
    const targets = buttons.map((button) => button.dataset['target']);
    expect(targets).toEqual(['card:merchant-reserve', 'card:war-chest']);
    expect(strip().querySelector('[data-target="card:settled-reach"]')).toBeNull();
    const goods = within(strip()).getByRole('button', { name: 'Händlerreserve (1)' });
    expect(goods.dataset['targetState']).toBe('legal');
    fireEvent.click(goods);
    expect(goods.getAttribute('aria-pressed')).toBe('true');
    expect(goods.dataset['targetState']).toBe('chosen');
  });

  it('ein geheimer Auftrag der Aktionsphase lässt sich vom Tisch werten', () => {
    const state = pickAll(started());
    const me = state.actionPhase?.active as PlayerId;
    const boots = objectiveId('boots-on-ground');
    const ready = updatePlayer(state, me, (p) => ({
      ...p,
      secretObjectives: [boots],
      roundStats: { ...p.roundStats, groundCombatsWon: 1 },
    }));
    expect([...scorableNow(ready, me, content)]).toEqual([boots]);
    seatTable(ready, { me });
    render(<Live />);
    const name = objectiveLabel(boots, 'de');
    fireEvent.click(within(strip()).getByRole('button', { name: `Werten: ${name}` }));
    expect(useGameStore.getState().error).toBeNull();
    expect(findPlayer(game(), me)?.victoryPoints).toBe(1);
    expect(within(strip()).queryByRole('button', { name: `Werten: ${name}` })).toBeNull();
  });

  it('gewertete Aufträge tragen die Scheiben der Spieler', () => {
    const state = pickAll(started());
    const [first, second] = state.players;
    const slot = state.objectives.public.find((entry) => entry.revealed);
    if (first === undefined || second === undefined || slot === undefined) throw new Error('Tisch');
    const scored = { [slot.id]: [first.id, second.id] };
    seatTable({ ...state, objectives: { ...state.objectives, scored } }, { me: first.id });
    render(<Live />);
    const item = strip().querySelector('[data-scored="true"]') as HTMLElement;
    expect(item.textContent).toContain(objectiveLabel(slot.id, 'de'));
    const discs = within(item).getByRole('img', {
      name: `Gewertet von: ${first.name}, ${second.name}`,
    });
    const seats = [...discs.querySelectorAll<HTMLElement>('.objective-strip-disc')];
    expect(seats.map((disc) => disc.dataset['seat'])).toEqual([
      String(first.seat + 1),
      String(second.seat + 1),
    ]);
    expect(seats[0]?.style.getPropertyValue('--seat')).toBe(seatColor(first.seat + 1));
    expect(strip().querySelectorAll('[data-scored="true"]')).toHaveLength(1);
  });
});
