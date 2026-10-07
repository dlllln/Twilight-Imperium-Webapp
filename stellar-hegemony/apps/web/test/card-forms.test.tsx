// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  findPlayer,
  type GameState,
  type PlayerId,
  type StrategyCardDefinition,
  unitTypeId,
} from '@stellar/domain';
import type { ReactElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { homeSystemOf } from '../src/card-view.ts';
import { ChoiceForm } from '../src/components/game/ChoiceForm.tsx';
import { useGameStore } from '../src/game-store.ts';
import { content, useGalaxyStore } from '../src/store.ts';
import { pickAll, started } from './game-helpers.ts';

afterEach(cleanup);

const store = () => useGameStore.getState();
const game = () => store().game as GameState;

const cardOf = (mechanic: StrategyCardDefinition['mechanic']) =>
  content.strategyCards.find((card) => card.mechanic === mechanic) as StrategyCardDefinition;

/** Der aktive Spieler bekommt die Karte zusätzlich; optional liegt ein Marker in seiner Heimat. */
function holding(mechanic: StrategyCardDefinition['mechanic'], tokenAtHome = false) {
  useGalaxyStore.setState({ language: 'de' });
  const state = pickAll(started());
  const player = state.actionPhase?.active as PlayerId;
  const card = cardOf(mechanic);
  const held = { ...state.strategyCards[card.id], holder: player, exhausted: false };
  const home = homeSystemOf(state, player, content) as string;
  const system = state.systems[home] as GameState['systems'][string];
  const systems = tokenAtHome
    ? { ...state.systems, [home]: { ...system, commandTokens: [player] } }
    : state.systems;
  useGameStore.setState({
    game: { ...state, systems, strategyCards: { ...state.strategyCards, [card.id]: held } },
  } as never);
  return { player, card, home };
}

/** Formular der Karte; die Auswahl geht wie im Spiel als Command an die Domain. */
function Live(props: {
  readonly player: PlayerId;
  readonly card: StrategyCardDefinition;
  readonly ability: 'primary' | 'secondary';
}): ReactElement | null {
  const current = useGameStore((state) => state.game);
  const send = useGameStore((state) => state.send);
  if (current === null) return null;
  return (
    <ChoiceForm
      game={current}
      {...props}
      onSubmit={(choice) =>
        send(
          props.ability === 'primary'
            ? {
                type: 'PerformStrategicAction',
                issuedBy: props.player,
                card: props.card.id,
                choice,
              }
            : { type: 'ResolveSecondary', issuedBy: props.player, choice },
        )
      }
    />
  );
}

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
