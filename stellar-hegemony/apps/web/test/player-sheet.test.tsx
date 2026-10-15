// @vitest-environment jsdom
import { currentActor, findPlayer, type GameState, type PlayerId } from '@stellar/domain';
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PlayerSheet } from '../src/components/sheet/PlayerSheet.tsx';
import { CommandToken } from '../src/components/sheet/SheetTokens.tsx';
import { useGameStore } from '../src/game-store.ts';
import { useSettingsStore } from '../src/settings-store.ts';
import { content, useGalaxyStore } from '../src/store.ts';
import { pickAll, started } from './game-helpers.ts';
import { leaveTable } from './local-table.ts';

beforeEach(() => {
  useGalaxyStore.setState({ language: 'de' });
  useSettingsStore.setState({ animations: false });
});

afterEach(() => {
  cleanup();
  leaveTable();
});

const game = () => useGameStore.getState().game as GameState;
const tokensIn = (element: HTMLElement, zone: string) =>
  element.querySelectorAll(`.sheet-token[data-zone="${zone}"]`);

/** Pult, das dem Spielstand folgt. */
function Live(): ReactElement | null {
  const current = useGameStore((state) => state.game);
  return current === null ? null : <PlayerSheet game={current} />;
}

/** Aktionsphase mit dem Spieler am Zug als eigenem Platz und seinem Heimatsystem. */
function actionPhase() {
  const state = pickAll(started());
  const actor = currentActor(state) as PlayerId;
  const home = Object.values(state.systems).find((system) =>
    system.spaceUnits.some((unit) => unit.owner === actor),
  );
  if (home === undefined) throw new Error('kein Heimatsystem');
  return { actor, home: home.id };
}

const activate = (actor: PlayerId, system: GameState['systems'][string]['id']) =>
  act(() => {
    useGameStore.getState().send({ type: 'ActivateSystem', issuedBy: actor, system });
  });

describe('Kommandopult vor dem eigenen Platz', () => {
  it('zu Beginn liegen drei Taktikmarker in ihren Fassungen, acht im Nachschub', () => {
    actionPhase();
    render(<Live />);
    const sheet = screen.getByRole('region', { name: 'Dein Kommandopult' });
    expect(sheet.hasAttribute('data-seat')).toBe(false);
    expect(within(sheet).queryAllByRole('button')).toHaveLength(0);
    const wing = screen.getByRole('group', { name: 'Kommandomarker' });
    const tactic = within(wing).getByLabelText('Taktik: 3');
    expect(tokensIn(tactic, 'tactic')).toHaveLength(3);
    expect(within(wing).getByLabelText('Flotte: 3')).toBeTruthy();
    expect(within(wing).getByLabelText('Strategie: 2')).toBeTruthy();
    expect(within(wing).getByLabelText('Nachschub: 8')).toBeTruthy();
    expect(within(wing).getByText('Auf der Karte: 0')).toBeTruthy();
  });

  it('die Schatzkammer zeigt Planetenwerte, Siegpunkte und genau so viele Rohstoff-Fassungen wie das Limit', () => {
    const { actor } = actionPhase();
    render(<Live />);
    const treasury = screen.getByRole('group', { name: 'Schatzkammer' });
    expect(within(treasury).getByLabelText(/^Ressourcen: \d+\/\d+$/)).toBeTruthy();
    expect(within(treasury).getByLabelText(/^Einfluss: \d+\/\d+$/)).toBeTruthy();
    expect(within(treasury).getByLabelText('Siegpunkte: 0/10')).toBeTruthy();
    const limit = findPlayer(game(), actor)?.commodityLimit ?? 0;
    expect(limit).toBeGreaterThan(0);
    const commodities = within(treasury).getByLabelText(`Rohstoffe: 0/${String(limit)}`);
    expect(commodities.querySelectorAll('.sheet-socket')).toHaveLength(limit);
    expect(commodities.querySelectorAll('.sheet-crate')).toHaveLength(0);
  });

  it('eine Systemaktivierung nimmt einen Taktikmarker vom Pult und legt ihn auf die Karte', async () => {
    const { actor, home } = actionPhase();
    render(<Live />);
    activate(actor, home);
    const tactic = screen.getByLabelText('Taktik: 2');
    await waitFor(() => expect(tokensIn(tactic, 'tactic')).toHaveLength(2));
    expect(screen.getByText('Auf der Karte: 1')).toBeTruthy();
    expect(screen.getByLabelText('Nachschub: 8')).toBeTruthy();
  });

  it('ohne Animationen erscheint keine Änderungsanzeige', () => {
    const { actor, home } = actionPhase();
    render(<Live />);
    activate(actor, home);
    expect(document.querySelector('.sheet-delta')).toBeNull();
  });

  it('mit Animationen zeigt die Taktikleiste kurz „−1“', () => {
    useSettingsStore.setState({ animations: true });
    const { actor, home } = actionPhase();
    render(<Live />);
    activate(actor, home);
    const delta = screen.getByLabelText('Taktik: 2').querySelector('.sheet-delta');
    expect(delta?.textContent).toBe('−1');
    expect(delta?.classList.contains('down')).toBe(true);
  });

  it('der letzte Zug leuchtet nicht erneut auf, wenn das Pult neu erscheint oder Animationen wieder angehen', () => {
    useSettingsStore.setState({ animations: true });
    const { actor, home } = actionPhase();
    const first = render(<Live />);
    activate(actor, home);
    expect(document.querySelector('.sheet-delta')).not.toBeNull();
    first.unmount();
    render(<Live />);
    expect(screen.getByLabelText('Taktik: 2')).toBeTruthy();
    expect(document.querySelector('.sheet-delta')).toBeNull();
    act(() => useSettingsStore.setState({ animations: false }));
    act(() => useSettingsStore.setState({ animations: true }));
    expect(document.querySelector('.sheet-delta')).toBeNull();
  });

  it('ohne eigenen Platz gibt es kein Pult', () => {
    actionPhase();
    useGameStore.setState({ me: null });
    render(<Live />);
    expect(screen.queryByRole('region', { name: 'Dein Kommandopult' })).toBeNull();
  });
});

describe('Kommandomarker je Fraktion', () => {
  it('jede Fraktion trägt einen sichtbaren Stern mit drei bis sechs Zacken', () => {
    expect(content.factions.length).toBeGreaterThan(0);
    for (const faction of content.factions) {
      const { container, unmount } = render(<CommandToken faction={faction.id} />);
      const points = container.querySelector('.token-glyph')?.getAttribute('points') ?? '';
      const corners = points.split(' ').filter(Boolean).length;
      expect(corners).toBeGreaterThanOrEqual(6);
      expect(corners).toBeLessThanOrEqual(12);
      unmount();
    }
  });
});
