// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { FactionsPanel } from '../src/components/faction/FactionsPanel.tsx';
import { useGalaxyStore } from '../src/store.ts';
import { started } from './game-helpers.ts';

afterEach(cleanup);

describe('Fraktionen im Browser (RR 27.21)', () => {
  it('RR 27.21: jede Fraktion zeigt ihren Namen, ihre zwei Fähigkeiten und ihren Mech (PoK Mech)', () => {
    useGalaxyStore.setState({ language: 'de' });
    const game = started();
    render(<FactionsPanel game={game} />);
    expect(screen.getByText('Fraktionen')).toBeTruthy();
    for (const player of game.players) {
      const entry = screen.getByTestId(`faction-${player.id}`);
      expect(within(entry).getAllByRole('listitem')).toHaveLength(3);
    }
    expect(screen.getByText('Doppellafetten')).toBeTruthy();
    expect(screen.getByText('Werftverbund')).toBeTruthy();
    expect(screen.getByText('Deine Werften produzieren 2 Einheiten mehr.')).toBeTruthy();
  });
});
