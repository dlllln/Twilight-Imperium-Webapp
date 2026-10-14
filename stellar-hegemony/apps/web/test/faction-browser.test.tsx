// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { FactionBrowser } from '../src/components/faction/FactionBrowser.tsx';
import { useGalaxyStore } from '../src/store.ts';

afterEach(cleanup);

describe('All faction browser', () => {
  it('searches both language names and filters each official edition', () => {
    useGalaxyStore.setState({ language: 'de' });
    render(
      <FactionBrowser>
        {(id) => (
          <button key={id} role="radio">
            {id}
          </button>
        )}
      </FactionBrowser>,
    );
    expect(screen.getAllByRole('radio')).toHaveLength(30);
    fireEvent.change(screen.getByLabelText('Fraktionsedition'), { target: { value: 'te' } });
    expect(screen.getAllByRole('radio')).toHaveLength(5);
    fireEvent.change(screen.getByLabelText('Fraktionen suchen'), { target: { value: 'crimson' } });
    expect(screen.getAllByRole('radio')).toHaveLength(1);
    expect(screen.getByRole('radio').textContent).toBe('crimson');
    fireEvent.change(screen.getByLabelText('Fraktionen suchen'), {
      target: { value: 'no such faction' },
    });
    expect(screen.queryByRole('radio')).toBeNull();
    expect(screen.getByText('Keine passende Fraktion gefunden.')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Fraktionsedition'), { target: { value: 'all' } });
    fireEvent.change(screen.getByLabelText('Fraktionen suchen'), {
      target: { value: 'Universities' },
    });
    expect(screen.getByRole('radio').textContent).toBe('jolnar');
  });
});
