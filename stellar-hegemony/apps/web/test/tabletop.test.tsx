// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  actionCardId,
  HIDDEN,
  planetId,
  playerId,
  type GameEvent,
  type GameState,
} from '@stellar/domain';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TabletopZones } from '../src/components/tabletop/TabletopZones.tsx';
import { PlayerRail } from '../src/components/hud/PlayerRail.tsx';
import { tabletopMovements, tabletopPiles } from '../src/components/tabletop/tabletop-model.ts';
import { useGameStore } from '../src/game-store.ts';
import { useSettingsStore } from '../src/settings-store.ts';
import { useGalaxyStore } from '../src/store.ts';
import { started } from './game-helpers.ts';

const firstPlayer = (game: GameState) => {
  const player = game.players[0];
  if (player === undefined) throw new Error('A table needs a player');
  return player.id;
};

beforeEach(() => {
  useGameStore.getState().leave();
  useGalaxyStore.setState({ language: 'de' });
  useSettingsStore.setState({ animations: false });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('Tabletop components and privacy', () => {
  it('closes an open supply when entering a narrow screen and keeps its manual toggle usable', () => {
    const change = new Set<() => void>();
    const media = {
      matches: true,
      addEventListener: (_: string, listener: () => void) => change.add(listener),
      removeEventListener: (_: string, listener: () => void) => change.delete(listener),
    };
    vi.stubGlobal('matchMedia', (query: string) =>
      query.includes('min-width')
        ? media
        : { matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() },
    );
    const view = render(<TabletopZones game={started()} />);
    const toggle = screen.getByRole('button', { name: 'Gemeinsamer Vorrat' });
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    act(() => {
      media.matches = false;
      for (const update of change) update();
    });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    view.rerender(<TabletopZones game={started()} />);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    view.unmount();
    expect(change.size).toBe(0);
  });

  it('keeps every draw pile facedown and only shows the public discard face', () => {
    const fresh = started();
    const discarded = actionCardId('black-market');
    const piles = tabletopPiles({
      ...fresh,
      actionDeck: { ...fresh.actionDeck, discard: [discarded] },
    });
    expect(
      piles
        .filter((pile) => pile.id !== 'discard')
        .every((pile) => pile.artwork.path.endsWith('-back.jpg')),
    ).toBe(true);
    expect(piles.find((pile) => pile.id === 'discard')).toMatchObject({
      count: 1,
      artwork: { path: '/ti4/cards/action.jpg' },
    });
    expect(piles.find((pile) => pile.id === 'action')?.count).toBe(fresh.actionDeck.deck.length);
  });

  it('shows opponents only a card back even if an unmasked event reaches the view', () => {
    const game = started();
    const owner = firstPlayer(game);
    const cards = [actionCardId('black-market'), actionCardId('supply-convoy')];
    const events: readonly GameEvent[] = [{ type: 'ActionCardsDrawn', player: owner, cards }];
    const own = tabletopMovements(events, { game, viewer: owner });
    const opponent = tabletopMovements(events, { game, viewer: playerId('someone-else') });
    expect(own[0]?.artwork).toBeDefined();
    expect(opponent[0]).toMatchObject({ kind: 'draw', count: 2 });
    expect(opponent[0]?.artwork).toBeUndefined();
    expect(JSON.stringify(opponent)).not.toContain('black-market');
    expect(
      tabletopMovements(
        [{ type: 'ActionCardsDrawn', player: owner, cards: [actionCardId(HIDDEN)] }],
        { game, viewer: owner },
      )[0]?.artwork,
    ).toBeUndefined();
  });

  it('animates public plays, actual payments and exhaustion only when their event exists', () => {
    const game = started();
    const player = firstPlayer(game);
    const card = actionCardId('black-market');
    const events: readonly GameEvent[] = [
      { type: 'ActionCardPlayed', player, card, target: {}, awaiting: [] },
      { type: 'TradeGoodsSpent', player, amount: 3 },
      {
        type: 'PlanetsExhausted',
        player,
        planets: [Object.values(game.planets)[0]?.id ?? planetId('test-world')],
      },
      { type: 'TradeGoodsGained', player, amount: 0 },
    ];
    expect(
      tabletopMovements(events, { game, viewer: null }).map(({ kind, item, count }) => ({
        kind,
        item,
        count,
      })),
    ).toEqual([
      { kind: 'play', item: 'action', count: 1 },
      { kind: 'spend', item: 'goods', count: 3 },
      { kind: 'exhaust', item: 'planet', count: 1 },
    ]);
    expect(tabletopMovements([], { game, viewer: player })).toEqual([]);
  });

  it('lets a player fold the fixed piles without changing the game', () => {
    const game = started();
    render(<TabletopZones game={game} />);
    const toggle = screen.getByRole('button', { name: 'Gemeinsamer Vorrat' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByLabelText(`Aktion: ${String(game.actionDeck.deck.length)}`)).toBeTruthy();
    expect(useGameStore.getState().game).toBeNull();
  });

  it('keeps opponent mat cards private and turns the held strategy only when its state is exhausted', () => {
    const fresh = started();
    const player = firstPlayer(fresh);
    const strategy = Object.values(fresh.strategyCards)[0];
    if (strategy === undefined) throw new Error('Strategy pile is empty');
    const game = {
      ...fresh,
      players: fresh.players.map((owner) => ({
        ...owner,
        actionCards: [actionCardId('black-market')],
      })),
      strategyCards: { ...fresh.strategyCards, [strategy.id]: { ...strategy, holder: player } },
    };
    const view = render(<PlayerRail game={game} />);
    expect(document.querySelectorAll('.portrait-tabletop-backs')).toHaveLength(game.players.length);
    expect(view.container.innerHTML).not.toContain('black-market');
    expect(
      document.querySelectorAll('.portrait-tabletop-strategy[data-exhausted="true"]'),
    ).toHaveLength(0);
    view.rerender(
      <PlayerRail
        game={{
          ...game,
          strategyCards: {
            ...game.strategyCards,
            [strategy.id]: { ...strategy, holder: player, exhausted: true },
          },
        }}
      />,
    );
    expect(
      document.querySelectorAll('.portrait-tabletop-strategy[data-exhausted="true"]'),
    ).toHaveLength(1);
  });
});

function LiveTable() {
  const game = useGameStore((state) => state.game);
  return game === null ? null : <TabletopZones game={game} />;
}

describe('Short tabletop transactions', () => {
  it('does not replay a reconnect, shows a still readable event with motion off, then clears it', () => {
    vi.useFakeTimers();
    const game = started();
    const player = firstPlayer(game);
    const event: GameEvent = { type: 'TradeGoodsSpent', player, amount: 2 };
    useGameStore.setState({ game, lastEvents: { serial: 1, before: game, events: [event] } });
    render(<LiveTable />);
    expect(document.querySelectorAll('.tabletop-transaction')).toHaveLength(0);
    act(() =>
      useGameStore
        .getState()
        .receive({ state: { ...game, version: game.version + 1 }, events: [event] }),
    );
    expect(screen.getByText('bezahlt', { exact: false })).toBeTruthy();
    expect(document.querySelector('.tabletop-transactions')?.getAttribute('data-motion')).toBe(
      'false',
    );
    act(() => {
      vi.advanceTimersByTime(2400);
    });
    expect(document.querySelectorAll('.tabletop-transaction')).toHaveLength(0);
  });

  it('uses only a secret back for another player drawing and leaves no card identity in the DOM', () => {
    const game: GameState = started();
    const player = firstPlayer(game);
    useGameStore.setState({ game, me: playerId('different-player') });
    render(<LiveTable />);
    act(() =>
      useGameStore.getState().receive({
        state: game,
        events: [{ type: 'ActionCardsDrawn', player, cards: [actionCardId('black-market')] }],
      }),
    );
    const card = document.querySelector('.tabletop-moving-component img');
    expect(card?.getAttribute('src')).toBe('/ti4/cards/action-back.jpg');
    expect(document.querySelector('.tabletop-transactions')?.textContent).not.toContain(
      'black-market',
    );
  });
});
