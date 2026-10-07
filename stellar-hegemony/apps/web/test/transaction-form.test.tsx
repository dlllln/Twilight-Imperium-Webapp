// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  findPlayer,
  type GameState,
  type PlayerId,
  unitId,
  unitTypeId,
  updatePlayer,
} from '@stellar/domain';
import type { ReactElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { homeSystemOf } from '../src/card-view.ts';
import { TurnPanel } from '../src/components/game/TurnPanel.tsx';
import { useGameStore } from '../src/game-store.ts';
import { currentActor } from '../src/local-game.ts';
import { content, useGalaxyStore } from '../src/store.ts';
import { pickAll, started } from './game-helpers.ts';

afterEach(cleanup);

const game = () => useGameStore.getState().game as GameState;

function Live(): ReactElement | null {
  const current = useGameStore((state) => state.game);
  return current === null ? null : <TurnPanel game={current} />;
}

/** Ein Kreuzer des nächsten Spielers liegt in der Heimat des aktiven: beide sind Nachbarn. */
function neighbours(): { readonly player: PlayerId; readonly partner: PlayerId } {
  useGalaxyStore.setState({ language: 'de' });
  const state = pickAll(started());
  const player = state.actionPhase?.active as PlayerId;
  const partner = state.players.find((p) => p.id !== player)?.id as PlayerId;
  const home = homeSystemOf(state, player, content) as string;
  const system = state.systems[home] as GameState['systems'][string];
  const guest = { id: unitId('gast'), type: unitTypeId('cruiser'), owner: partner, damaged: false };
  const visited = {
    ...state,
    systems: { ...state.systems, [home]: { ...system, spaceUnits: [...system.spaceUnits, guest] } },
  };
  useGameStore.setState({
    game: updatePlayer(visited, player, (p) => ({ ...p, tradeGoods: 2 })),
    error: null,
  });
  return { player, partner };
}

describe('Tausch mit Nachbarn (RR 82)', () => {
  it('Angebot machen, der Nachbar entscheidet am selben Bildschirm und nimmt an', () => {
    const { player, partner } = neighbours();
    render(<Live />);
    fireEvent.click(screen.getByRole('button', { name: 'Geben: Handelswaren +' }));
    fireEvent.click(screen.getByRole('button', { name: 'Geben: Handelswaren +' }));
    fireEvent.click(screen.getByRole('button', { name: 'Angebot machen' }));
    expect(currentActor(game())).toBe(partner);
    expect(screen.getByTestId('offer').textContent).toContain('2 Handelswaren');
    fireEvent.click(screen.getByRole('button', { name: 'Annehmen' }));
    expect(findPlayer(game(), player)?.tradeGoods).toBe(0);
    expect(findPlayer(game(), partner)?.tradeGoods).toBe(2);
    expect(currentActor(game())).toBe(player);
    // Mit diesem Nachbarn ist in diesem Zug kein weiterer Tausch möglich.
    expect(screen.queryByText('Tausch mit Nachbarn')).toBeNull();
  });

  it('ein abgelehntes Angebot ändert nichts', () => {
    const { player } = neighbours();
    render(<Live />);
    fireEvent.click(screen.getByRole('button', { name: 'Angebot machen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ablehnen' }));
    expect(game().actionPhase?.transaction).toBeNull();
    expect(findPlayer(game(), player)?.tradeGoods).toBe(2);
  });
});
