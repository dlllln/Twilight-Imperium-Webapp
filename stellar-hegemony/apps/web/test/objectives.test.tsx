// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  findPlayer,
  type GameState,
  objectiveId,
  type ObjectiveId,
  type PlayerId,
  updatePlayer,
} from '@stellar/domain';
import { afterEach, describe, expect, it } from 'vitest';
import { objectiveFrame } from '../src/artwork/cards.ts';
import { ObjectivesPanel } from '../src/components/objectives/ObjectivesPanel.tsx';
import { SecretChoiceForm } from '../src/components/objectives/SecretChoiceForm.tsx';
import { TurnPanel } from '../src/components/game/TurnPanel.tsx';
import { useGameStore } from '../src/game-store.ts';
import { currentActor } from '@stellar/domain';
import { useGalaxyStore } from '../src/store.ts';
import { objectiveLabel, objectiveRequirement } from '../src/labels.ts';
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
      const [first, second] = screen.getAllByRole<HTMLInputElement>('radio');
      fireEvent.click(first as HTMLInputElement);
      expect(second?.disabled).toBe(false);
      fireEvent.click(keep());
    }
    expect(store().error).toBeNull();
    expect(game().players.every((player) => player.secretObjectives.length === 1)).toBe(true);
    expect(screen.queryByRole('button', { name: 'Behalten' })).toBeNull();
  });

  it('legt vollständige Originalkarten aus und lässt die Einzelwahl direkt wechseln', () => {
    useGalaxyStore.setState({ language: 'de' });
    const state = started();
    seatTable(state);
    const player = currentActor(state) as PlayerId;
    const options = findPlayer(state, player)?.secretChoice?.options ?? [];
    render(<SecretChoiceForm game={state} player={player} />);

    const dialog = screen.getByRole('dialog', { name: 'Geheime Aufträge wählen' });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    const cards = screen.getAllByRole<HTMLInputElement>('radio');
    for (const [index, id] of options.entries()) {
      const card = screen.getByRole('radio', {
        name: (name) =>
          name.includes(objectiveLabel(id, 'de')) && name.includes(objectiveRequirement(id, 'de')),
      });
      expect(card).toBe(cards[index]);
      const image = card.closest('label')?.querySelector('.ti4-complete-card img');
      expect(image?.getAttribute('src')).toBe(objectiveFrame(id, 'secret', null).path);
    }

    const first = cards[0] as HTMLInputElement;
    const second = cards[1] as HTMLInputElement;
    fireEvent.click(first);
    expect(first.checked).toBe(true);
    expect(second.disabled).toBe(false);
    fireEvent.click(second);
    expect(first.checked).toBe(false);
    expect(second.checked).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Behalten' }));
    expect(store().error).toBeNull();
    expect(findPlayer(game(), player)?.secretObjectives).toEqual([options[1]]);
  });

  it('behält bei mehreren Aufträgen das Kontingent und gibt abgewählte Plätze wieder frei', () => {
    useGalaxyStore.setState({ language: 'de' });
    const state = started();
    const player = currentActor(state) as PlayerId;
    const options = ['storm-riders', 'swarm-doctrine', 'iron-fist'].map(objectiveId);
    const offered = updatePlayer(state, player, (seat) => ({
      ...seat,
      secretChoice: { options, keep: 2 },
    }));
    render(<SecretChoiceForm game={offered} player={player} />);
    const cards = screen.getAllByRole<HTMLInputElement>('checkbox');
    const keep = screen.getByRole<HTMLButtonElement>('button', { name: 'Behalten' });
    fireEvent.click(cards[0] as HTMLInputElement);
    expect(keep.disabled).toBe(true);
    expect(cards[2]?.disabled).toBe(false);
    fireEvent.click(cards[1] as HTMLInputElement);
    expect(keep.disabled).toBe(false);
    expect(cards[2]?.disabled).toBe(true);
    expect(cards[0]?.disabled).toBe(false);
    fireEvent.click(cards[0] as HTMLInputElement);
    expect(cards[2]?.disabled).toBe(false);
    expect(keep.disabled).toBe(true);
    fireEvent.click(cards[2] as HTMLInputElement);
    expect(keep.disabled).toBe(false);
  });

  it('behält die Wahl bei normalen Updates, verwirft sie aber bei neuen Karten oder anderem Spieler', () => {
    useGalaxyStore.setState({ language: 'de' });
    const state = started();
    const player = currentActor(state) as PlayerId;
    const options = findPlayer(state, player)?.secretChoice?.options ?? [];
    const view = render(<SecretChoiceForm game={state} player={player} />);
    fireEvent.click(screen.getAllByRole('radio')[0] as HTMLInputElement);
    const updated = updatePlayer({ ...state, version: state.version + 1 }, player, (seat) => ({
      ...seat,
      secretChoice: { options: [...options], keep: 1 },
    }));
    view.rerender(<SecretChoiceForm game={updated} player={player} />);
    expect(screen.getAllByRole<HTMLInputElement>('radio')[0]?.checked).toBe(true);

    const replacement = ['storm-riders', 'swarm-doctrine', 'iron-fist']
      .map(objectiveId)
      .find((id) => !options.includes(id)) as ObjectiveId;
    const next = updatePlayer(updated, player, (seat) => ({
      ...seat,
      secretChoice: { options: [options[0] as ObjectiveId, replacement], keep: 1 },
    }));
    view.rerender(<SecretChoiceForm game={next} player={player} />);
    expect(screen.getAllByRole<HTMLInputElement>('radio').every((card) => !card.checked)).toBe(
      true,
    );
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Behalten' }).disabled).toBe(true);

    fireEvent.click(screen.getAllByRole('radio')[0] as HTMLInputElement);
    const other = state.players.find((seat) => seat.id !== player)?.id as PlayerId;
    const switched = updatePlayer(next, other, (seat) => ({
      ...seat,
      secretChoice: findPlayer(next, player)?.secretChoice ?? null,
    }));
    view.rerender(<SecretChoiceForm game={switched} player={other} />);
    expect(screen.getAllByRole<HTMLInputElement>('radio').every((card) => !card.checked)).toBe(
      true,
    );
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Behalten' }).disabled).toBe(true);
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
