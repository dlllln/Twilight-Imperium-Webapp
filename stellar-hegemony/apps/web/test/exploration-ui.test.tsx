// @vitest-environment jsdom
import { seatPlayerId } from '@stellar/application';
import {
  currentActor,
  explorationCardId,
  type FragmentKind,
  type GameEvent,
  type GameState,
  type PlayerId,
  relicId,
} from '@stellar/domain';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ExplorationPanel } from '../src/components/exploration/ExplorationPanel.tsx';
import { HistoryPanel } from '../src/components/history/HistoryPanel.tsx';
import { HandDock } from '../src/components/hand/HandDock.tsx';
import { useGameStore } from '../src/game-store.ts';
import { handEntries, tableEntries } from '../src/hand/hand-model.ts';
import { useHandStore } from '../src/hand/hand-store.ts';
import { appendHistory, historyLines } from '../src/history/turn-history.ts';
import { freshEntries } from '../src/notices/fresh-notices.ts';
import { gameScene } from '../src/render/scene-model.ts';
import { useSettingsStore } from '../src/settings-store.ts';
import { content, useGalaxyStore } from '../src/store.ts';
import { pickAll, started } from './game-helpers.ts';
import { leaveTable, seatTable } from './local-table.ts';

beforeEach(() => {
  useGalaxyStore.setState({ language: 'de' });
  useSettingsStore.setState({ animations: false, handOpen: true });
  useHandStore.getState().clear();
  leaveTable();
});

afterEach(cleanup);

const game = () => useGameStore.getState().game as GameState;
const P1 = seatPlayerId(0);

/** Gibt dem Spieler Relikte und Fragmente, wie sie die Erkundung bringen würde. */
function withFinds(
  state: GameState,
  player: PlayerId,
  finds: { relics?: readonly string[]; fragments?: readonly FragmentKind[] },
): GameState {
  const relics = (finds.relics ?? []).map((id) => ({ id: relicId(id), exhausted: false }));
  return {
    ...state,
    players: state.players.map((entry) =>
      entry.id === player
        ? { ...entry, relics, relicFragments: finds.fragments ?? entry.relicFragments }
        : entry,
    ),
  };
}

/** Partie in der Aktionsphase; der Spieler am Zug bekommt die Funde. */
function actionTurn(finds: Parameters<typeof withFinds>[2]): PlayerId {
  const state = pickAll(started());
  const actor = currentActor(state) as PlayerId;
  seatTable(withFinds(state, actor, finds), { me: actor });
  return actor;
}

const input = (actor: PlayerId) => ({
  game: game(),
  actor,
  viewer: actor,
  selected: null,
  choosing: false,
});

function Live(): ReactElement | null {
  const current = useGameStore((state) => state.game);
  return current === null ? null : <HandDock game={current} />;
}

describe('PoK Relikte und Fragmente in der Hand', () => {
  it('PoK Relikt: ein Aktionsrelikt liegt als Karte in der Hand und wirkt beim Ausspielen', () => {
    const actor = actionTurn({ relics: ['trade-prism', 'wanderers-star-chart'] });
    const before = game().players.find((player) => player.id === actor)?.tradeGoods ?? 0;
    const relics = tableEntries(input(actor)).filter((entry) => entry.kind === 'relic');
    expect(relics.map((entry) => entry.playable)).toEqual([true, false]);
    render(<Live />);
    fireEvent.click(screen.getByTestId('relic-trade-prism'));
    const after = game().players.find((player) => player.id === actor);
    expect(after?.tradeGoods).toBe(before + 2);
    expect(after?.relics.find((relic) => relic.id === 'trade-prism')?.exhausted).toBe(true);
  });

  it('PoK Fragmente: drei einer Art (Grenzfragment als Joker) werden zu einem Relikt', () => {
    const actor = actionTurn({ fragments: ['cultural', 'cultural', 'frontier'] });
    const deck = game().exploration.relicDeck.length;
    const fragments = tableEntries(input(actor)).filter((entry) => entry.kind === 'fragment');
    expect(fragments).toHaveLength(2);
    expect(fragments[0]).toMatchObject({ count: 2, playable: true });
    render(<Live />);
    fireEvent.click(screen.getByTestId('fragment-cultural'));
    const after = game().players.find((player) => player.id === actor);
    expect(after?.relicFragments).toEqual([]);
    expect(after?.relics).toHaveLength(1);
    expect(game().exploration.relicDeck).toHaveLength(deck - 1);
  });

  it('außerhalb des eigenen Zugs liegen die Karten nur zum Lesen da', () => {
    const actor = actionTurn({ relics: ['trade-prism'], fragments: ['hazardous'] });
    const other = game().players.find((player) => player.id !== actor)?.id as PlayerId;
    const state = withFinds(game(), other, { relics: ['mending-swarm'] });
    const entries = handEntries({ ...input(actor), game: state, actor, viewer: other });
    const table = entries.filter((entry) => entry.kind === 'relic');
    expect(table).toEqual([expect.objectContaining({ playable: false })]);
    const lone = tableEntries(input(actor)).find((entry) => entry.kind === 'fragment');
    expect(lone).toMatchObject({ purge: null, playable: false });
  });
});

describe('PoK Erkundung auf der Karte', () => {
  it('Grenzmarker und Depots erscheinen im Feld, Anlagen erhöhen die Planetenwerte', () => {
    const state = started();
    const [frontier] = state.exploration.frontierTokens;
    const planet = Object.values(state.planets)[0];
    if (frontier === undefined || planet === undefined) throw new Error('Aufbau ohne Marker');
    const attachment = { card: explorationCardId('rich-ore-veins'), resources: 2, influence: 0 };
    const changed: GameState = {
      ...state,
      planets: { ...state.planets, [planet.id]: { ...planet, attachments: [attachment] } },
      exploration: { ...state.exploration, caches: { [frontier]: 3 } },
    };
    const scene = gameScene(changed, content, 'de');
    expect(scene.find((hex) => hex.systemId === frontier)).toMatchObject({
      frontier: true,
      cache: 3,
    });
    const base = gameScene(state, content, 'de').flatMap((hex) => hex.planets);
    const shown = scene.flatMap((hex) => hex.planets).find((entry) => entry.id === planet.id);
    const plain = base.find((entry) => entry.id === planet.id);
    expect(shown?.attachments).toEqual(['rich-ore-veins']);
    expect(shown?.definition.resources).toBe((plain?.definition.resources ?? 0) + 2);
  });

  it('jedes leere blaue oder rote System bekommt zu Beginn einen Grenzmarker', () => {
    const state = started();
    expect(state.exploration.frontierTokens.length).toBeGreaterThan(0);
    for (const system of state.exploration.frontierTokens)
      expect(state.systems[system]?.planetIds).toEqual([]);
  });
});

describe('PoK Funde im Verlauf und in den Meldungen', () => {
  const events = [
    {
      type: 'PlanetExplored',
      player: P1,
      planet: 'elysar',
      deck: 'cultural',
      card: 'pilgrim-caravan',
    },
    { type: 'RelicDrawn', player: P1, relic: 'trade-prism' },
    { type: 'LegendaryAbilityUsed', player: P1, planet: 'morgantis' },
    { type: 'TradeGoodsCacheCollected', player: P1, system: 'b07', amount: 3 },
  ] as unknown as GameEvent[];

  it('erzählt Erkundung, Relikt, legendäre Fähigkeit und Depot in Worten', () => {
    expect(historyLines(events).map((line) => line.kind)).toEqual([
      'explored',
      'relicGained',
      'legendaryUsed',
      'cacheCollected',
    ]);
    seatTable(started());
    useGameStore.setState({ history: appendHistory([], events) });
    render(<HistoryPanel game={game()} />);
    expect(screen.getByText(/erkundet Elysar: Pilgerkarawane/)).toBeTruthy();
    expect(screen.getByText(/erhält das Relikt Handelsprisma/)).toBeTruthy();
    expect(screen.getByText(/nutzt Tiefenschmelze auf Morgantis/)).toBeTruthy();
  });

  it('eigene Funde melden sich auch beim eigenen Zug, eigene Routine nicht', () => {
    const history = appendHistory(
      [],
      [...events, { type: 'PlayerPassed', player: P1 } as unknown as GameEvent],
    );
    expect(freshEntries(history, 0, P1).map((entry) => entry.line.kind)).toEqual([
      'explored',
      'relicGained',
    ]);
  });

  it('die Übersicht zeigt Stapelgrößen und die Funde aller Spieler', () => {
    const state = withFinds(started(), P1, { relics: ['trade-prism'], fragments: ['industrial'] });
    render(<ExplorationPanel game={state} />);
    expect(screen.getByText('Erkundung und Relikte')).toBeTruthy();
    expect(screen.getByTestId(`finds-${P1}`).textContent).toContain('Industriell ×1');
    expect(screen.getByTestId(`finds-${P1}`).textContent).toContain('Handelsprisma');
  });
});
