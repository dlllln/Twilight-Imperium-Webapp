// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { findPlayer, type GameState, type PlayerId } from '@stellar/domain';
import { afterEach, describe, expect, it } from 'vitest';
import { ObjectivesPanel } from '../src/components/objectives/ObjectivesPanel.tsx';
import { TurnPanel } from '../src/components/game/TurnPanel.tsx';
import { useGameStore } from '../src/game-store.ts';
import { currentActor } from '@stellar/domain';
import { useGalaxyStore } from '../src/store.ts';
import { holding, Live } from './card-form-helpers.tsx';
import { pickAll, started } from './game-helpers.ts';
import { seatTable } from './local-table.ts';

afterEach(cleanup);

const store = () => useGameStore.getState();
const game = () => store().game as GameState;
const actor = () => currentActor(game()) as PlayerId;

/** Das Hot-Seat-Panel folgt dem Spielzustand wie in der App. */
function LivePanel() {
  const current = useGameStore((state) => state.game);
  return current === null ? null : <TurnPanel game={current} />;
}

/** Alle Strategiekarten gelten als genutzt; dann passen alle bis zur Statusphase. */
function statusPhase(): GameState {
  const state = pickAll(started());
  const strategyCards = Object.fromEntries(
    Object.entries(state.strategyCards).map(([id, card]) => [id, { ...card, exhausted: true }]),
  );
  useGameStore.setState({ game: { ...state, strategyCards } });
  while (game().phase === 'action') store().send({ type: 'Pass', issuedBy: actor() });
  return game();
}

describe('Geheime Aufträge zu Spielbeginn (RR 12.20)', () => {
  it('jeder Spieler behält genau einen; erst danach wird gewählt', () => {
    useGalaxyStore.setState({ language: 'de' });
    seatTable(started());
    render(<LivePanel />);
    const keep = () => screen.getByRole<HTMLButtonElement>('button', { name: 'Behalten' });
    expect(keep().disabled).toBe(true);
    for (let player = 0; player < 3; player += 1) {
      const [first, second] = screen.getAllByRole<HTMLInputElement>('checkbox');
      fireEvent.click(first as HTMLInputElement);
      expect(second?.disabled).toBe(true);
      fireEvent.click(keep());
    }
    expect(store().error).toBeNull();
    expect(game().players.every((player) => player.secretObjectives.length === 1)).toBe(true);
    expect(screen.queryByRole('button', { name: 'Behalten' })).toBeNull();
  });
});

describe('Statusphase im Browser (RR 73)', () => {
  it('RR 73.1/73.5: werten, Marker verteilen, dann beginnt Runde 2', () => {
    statusPhase();
    render(<LivePanel />);
    for (let player = 0; player < 3; player += 1)
      fireEvent.click(screen.getByRole('button', { name: 'Wertung beenden' }));
    expect(game().statusPhase?.step).toBe('tokens');
    for (let player = 0; player < 3; player += 1) {
      expect(screen.getByTestId('free-tokens').textContent).toBe('2');
      fireEvent.click(screen.getByRole('button', { name: 'Taktik +' }));
      fireEvent.click(screen.getByRole('button', { name: 'Flotte +' }));
      fireEvent.click(screen.getByRole('button', { name: 'Ausführen' }));
    }
    expect(store().error).toBeNull();
    expect(game()).toMatchObject({ phase: 'strategy', round: 2 });
  });

  it('die Statusphase zählt den Fraktionsbonus bei den erhaltenen Markern mit', () => {
    statusPhase();
    for (let player = 0; player < 3; player += 1)
      store().send({ type: 'EndScoring', issuedBy: actor() });
    const disciplined = actor();
    const players = game().players.map((player) =>
      player.id === disciplined
        ? { ...player, factionRules: { ...player.factionRules, statusCommandTokens: 1 } }
        : player,
    );
    useGameStore.setState({ game: { ...game(), players } });
    const tactic = findPlayer(game(), disciplined)?.commandPools.tactic ?? 0;
    render(<LivePanel />);
    expect(screen.getByTestId('free-tokens').textContent).toBe('3');
    for (let token = 0; token < 3; token += 1)
      fireEvent.click(screen.getByRole('button', { name: 'Taktik +' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ausführen' }));
    expect(store().error).toBeNull();
    expect(findPlayer(game(), disciplined)?.commandPools.tactic).toBe(tactic + 3);
  });

  it('RR 68: die Siegpunktleiste zeigt Stand und Ziel', () => {
    const state = statusPhase();
    render(<ObjectivesPanel game={state} />);
    const first = state.players[0]?.id as PlayerId;
    expect(screen.getByTestId(`vp-${first}`).textContent).toBe(
      `0/${String(state.config.victoryPointsToWin)}`,
    );
    expect(screen.getAllByText('Stufe I (verdeckt)').length).toBeGreaterThan(0);
  });

  it('RR 68.7: nach dem Sieg zeigt das Panel nur noch den Sieger', () => {
    const state = statusPhase();
    const winner = state.players[1] as GameState['players'][number];
    render(<TurnPanel game={{ ...state, phase: 'gameOver', winner: winner.id }} />);
    expect(screen.getByRole('status').textContent).toContain(winner.name);
  });
});

describe('Thron und Politik (RR 37, RR 61)', () => {
  it('RR 37.2: ohne Wertung und ohne Thronwelt kommt ein geheimer Auftrag hinzu', () => {
    const { player, card } = holding('imperial');
    const before = findPlayer(game(), player)?.secretObjectives.length ?? 0;
    render(<Live player={player} card={card} ability="primary" />);
    fireEvent.click(screen.getByRole('button', { name: 'Ausführen' }));
    expect(store().error).toBeNull();
    expect(findPlayer(game(), player)?.secretObjectives).toHaveLength(before + 1);
  });

  it('RR 61.2: ein anderer Spieler wird Sprecher', () => {
    const { player, card } = holding('politics');
    const speaker = game().speaker;
    render(<Live player={player} card={card} ability="primary" />);
    fireEvent.click(screen.getByRole('button', { name: 'Ausführen' }));
    expect(store().error).toBeNull();
    expect(game().speaker).not.toBe(speaker);
  });
});
