// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  findPlayer,
  type GameState,
  type PlayerId,
  spendablePlanets,
  unitTypeId,
} from '@stellar/domain';
import { afterEach, describe, expect, it } from 'vitest';
import { homeSystemOf } from '../src/card-view.ts';
import { useGameStore } from '../src/game-store.ts';
import { planetLabel } from '../src/labels.ts';
import { content } from '../src/store.ts';
import { holding, Live } from './card-form-helpers.tsx';

afterEach(cleanup);

const store = () => useGameStore.getState();
const game = () => store().game as GameState;

const awaiting = () => game().actionPhase?.secondary?.awaiting[0] as PlayerId;
const unitsOn = (planet: string, type: string) =>
  game().planets[planet]?.units.filter((unit) => unit.type === unitTypeId(type)).length ?? 0;

describe('Infrastruktur (RR 39)', () => {
  it('primär ein PVS auf dem Heimatplaneten, sekundär eines beim Nächsten', () => {
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

describe('Führung in der klassischen Ansicht (RR 50)', () => {
  it('Führung klassisch: ein Einflussplanet bringt weitere Marker', () => {
    const { player, card } = holding('commandTokens');
    const players = game().players.map((p) => (p.id === player ? { ...p, tradeGoods: 1 } : p));
    useGameStore.setState({ game: { ...game(), players } });
    const [planet] = spendablePlanets(game(), content.tiles, player, 'influence');
    if (planet === undefined || planet.value !== 2) throw new Error('Testpartie geändert');
    const tactic = findPlayer(game(), player)?.commandPools.tactic ?? 0;
    render(<Live player={player} card={card} ability="primary" />);
    const gained = () => screen.getByTestId('tokens-gained').textContent;
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '1' } });
    expect(gained()).toBe('3');
    fireEvent.click(screen.getByRole('button', { name: 'Taktik +' }));
    fireEvent.click(
      screen.getByRole('checkbox', { name: new RegExp(planetLabel(planet.planet, 'de')) }),
    );
    expect(screen.getByTestId('paid').textContent).toBe('3');
    expect(gained()).toBe('4');
    expect(screen.getByRole('status', { name: 'Taktik' }).textContent).toBe('0');
    for (let token = 0; token < 4; token += 1)
      fireEvent.click(screen.getByRole('button', { name: 'Taktik +' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ausführen' }));
    expect(store().error).toBeNull();
    expect(findPlayer(game(), player)).toMatchObject({ tradeGoods: 0 });
    expect(findPlayer(game(), player)?.commandPools.tactic).toBe(tactic + 4);
    expect(game().planets[planet.planet]?.exhausted).toBe(true);
  });
});

describe('Strategische Aktionen ohne wählbares Ziel', () => {
  it('Kriegsführung ohne eigenen Marker auf der Karte lässt sich ausführen', () => {
    const { player, card } = holding('warfare');
    const pools = findPlayer(game(), player)?.commandPools;
    render(<Live player={player} card={card} ability="primary" />);
    expect(screen.queryByLabelText('Marker zurücknehmen aus')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Ohne Marker ausführen' }));
    expect(store().error).toBeNull();
    expect(findPlayer(game(), player)?.commandPools).toEqual(pools);
    expect(game().strategyCards[card.id]?.exhausted).toBe(true);
  });

  it('Diplomatie ohne wählbares System lässt sich ausführen', () => {
    const { player, card } = holding('diplomacy');
    const planets = Object.fromEntries(
      Object.entries(game().planets).map(([id, planet]) => [
        id,
        planet.controller === player ? { ...planet, controller: null } : planet,
      ]),
    );
    useGameStore.setState({ game: { ...game(), planets } });
    render(<Live player={player} card={card} ability="primary" />);
    expect(screen.queryByLabelText('System wählen')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Ohne System ausführen' }));
    expect(store().error).toBeNull();
    expect(game().strategyCards[card.id]?.exhausted).toBe(true);
  });
});
