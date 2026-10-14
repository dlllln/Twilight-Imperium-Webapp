// @vitest-environment jsdom
import { seatPlayerId } from '@stellar/application';
import { domainError, type GameEvent, type GameState } from '@stellar/domain';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NoticeStack } from '../src/components/hud/NoticeStack.tsx';
import { useGameStore } from '../src/game-store.ts';
import { freshEntries, NOTICE_LIMIT, NOTICE_MS, withFresh } from '../src/notices/fresh-notices.ts';
import { useSettingsStore } from '../src/settings-store.ts';
import { useGalaxyStore } from '../src/store.ts';
import { started } from './game-helpers.ts';
import { leaveTable, seatTable } from './local-table.ts';

const P1 = seatPlayerId(0);
const P2 = seatPlayerId(1);

beforeEach(() => {
  useGalaxyStore.setState({ language: 'de' });
  useSettingsStore.setState({ animations: false });
  leaveTable();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function Live(): ReactElement | null {
  const game = useGameStore((state) => state.game);
  return game === null ? null : <NoticeStack game={game} />;
}

/** Ein anderer (oder man selbst) hat gerade etwas getan. */
function happened(events: readonly GameEvent[]) {
  const game = useGameStore.getState().game as GameState;
  act(() => useGameStore.getState().receive({ state: game, events }));
}

const picked = (player: typeof P1, card: string) =>
  ({ type: 'StrategyCardPicked', player, card }) as unknown as GameEvent;

describe('Benachrichtigungen unten rechts', () => {
  it('die offene Entscheidung ploppt als Benachrichtigung auf (hier: geheime Aufträge wählen)', () => {
    seatTable(started(), { me: P1 });
    render(<Live />);
    const decision = document.querySelector('.notice.decision');
    expect(decision?.textContent).toContain('Geheime Aufträge');
  });

  it('was die anderen tun, erscheint kurz; eigene Züge nicht; nach einer Weile verschwindet es', () => {
    vi.useFakeTimers();
    seatTable(started(), { me: P1 });
    render(<Live />);
    happened([picked(P1, 'vanguard'), picked(P2, 'embassy')]);
    const notices = screen.getAllByRole('status');
    expect(notices).toHaveLength(1);
    expect(notices[0]?.textContent).toContain('P2 wählt Diplomatie');
    act(() => {
      vi.advanceTimersByTime(NOTICE_MS + 10);
    });
    expect(screen.queryAllByRole('status')).toHaveLength(0);
  });

  it('eine Meldung lässt sich wegklicken; ein abgelehnter Befehl erscheint rot, bis man ihn schließt', () => {
    seatTable(started(), { me: P1 });
    render(<Live />);
    happened([picked(P2, 'embassy')]);
    fireEvent.click(screen.getByRole('button', { name: 'Meldung schließen' }));
    expect(screen.queryAllByRole('status')).toHaveLength(0);
    act(() => useGameStore.getState().setError(domainError('tactical.noToken', 'x')));
    expect(screen.getByRole('alert').textContent).toContain('Nicht erlaubt');
    fireEvent.click(screen.getByRole('button', { name: 'Meldung schließen' }));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('höchstens drei Meldungen auf einmal, die neuesten bleiben', () => {
    const entries = [1, 2, 3, 4, 5].map((id) => ({
      id,
      line: { kind: 'passed' as const, player: id === 2 ? P1 : P2 },
    }));
    const fresh = freshEntries(entries, 1, P1);
    expect(fresh.map((entry) => entry.id)).toEqual([3, 4, 5]);
    expect(withFresh(entries.slice(0, 2), fresh)).toHaveLength(NOTICE_LIMIT);
    expect(withFresh([], fresh).at(-1)?.id).toBe(5);
  });
});
