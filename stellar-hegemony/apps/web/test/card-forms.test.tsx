// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { findPlayer, type GameState, type PlayerId, unitTypeId } from '@stellar/domain';
import { afterEach, describe, expect, it } from 'vitest';
import { homeSystemOf } from '../src/card-view.ts';
import { useGameStore } from '../src/game-store.ts';
import { content } from '../src/store.ts';
import { holding, Live } from './card-form-helpers.tsx';

afterEach(cleanup);

const store = () => useGameStore.getState();
const game = () => store().game as GameState;

const awaiting = () => game().actionPhase?.secondary?.awaiting[0] as PlayerId;
const unitsOn = (planet: string, type: string) =>
  game().planets[planet]?.units.filter((unit) => unit.type === unitTypeId(type)).length ?? 0;

describe('Infrastruktur (RR 39)', () => {
  it('primär ein Orbitalgeschütz auf dem Heimatplaneten, sekundär eines beim Nächsten', () => {
    const { player, card, home } = holding('construction');
    const planet = game().systems[home]?.planetIds[0] as string;
    const before = unitsOn(planet, 'orbitalBattery');
    render(<Live player={player} card={card} ability="primary" />);
    fireEvent.click(screen.getByRole('button', { name: 'Bauen' }));
    expect(store().error).toBeNull();
    expect(unitsOn(planet, 'orbitalBattery')).toBe(before + 1);
    cleanup();
    const next = awaiting();
    render(<Live player={next} card={card} ability="secondary" />);
    fireEvent.click(screen.getByRole('button', { name: 'Bauen' }));
    expect(store().error).toBeNull();
    const nextHome = homeSystemOf(game(), next, content) as string;
    expect(game().systems[nextHome]?.commandTokens).toContain(next);
  });
});

describe('Handel (RR 34)', () => {
  it('primär Handelswaren und ein Mitspieler nutzt die Sekundärfähigkeit kostenlos', () => {
    const { player, card } = holding('trade');
    const goods = findPlayer(game(), player)?.tradeGoods ?? 0;
    render(<Live player={player} card={card} ability="primary" />);
    fireEvent.click(screen.getAllByRole('checkbox')[0] as HTMLElement);
    fireEvent.click(screen.getByRole('button', { name: 'Ausführen' }));
    expect(store().error).toBeNull();
    expect(findPlayer(game(), player)?.tradeGoods).toBe(goods + 3);
    expect(game().actionPhase?.secondary?.free).toHaveLength(1);
  });
});

describe('Kriegsführung (RR 49)', () => {
  it('primär Marker zurück auf die Tafel, sekundär Produktion im Heimatsystem', () => {
    const { player, card } = holding('warfare', true);
    const tactic = findPlayer(game(), player)?.commandPools.tactic ?? 0;
    render(<Live player={player} card={card} ability="primary" />);
    fireEvent.click(screen.getByRole('button', { name: 'Taktik +' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ausführen' }));
    expect(store().error).toBeNull();
    expect(findPlayer(game(), player)?.commandPools.tactic).toBe(tactic + 1);
    cleanup();
    const next = awaiting();
    const nextHome = homeSystemOf(game(), next, content) as string;
    const fighters = () =>
      game().systems[nextHome]?.spaceUnits.filter((u) => u.type === unitTypeId('fighter')).length ??
      0;
    const before = fighters();
    render(<Live player={next} card={card} ability="secondary" />);
    fireEvent.click(screen.getByRole('button', { name: 'Jäger +' }));
    fireEvent.click(screen.getAllByRole('checkbox')[0] as HTMLElement);
    fireEvent.click(screen.getByRole('button', { name: 'Produzieren' }));
    expect(store().error).toBeNull();
    expect(fighters()).toBe(before + 1);
  });
});
