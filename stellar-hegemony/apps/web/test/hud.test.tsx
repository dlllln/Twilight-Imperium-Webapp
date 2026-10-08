// @vitest-environment jsdom
import { FACTIONS } from '@stellar/content';
import type { GameState, PlayerId } from '@stellar/domain';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FactionDraft } from '../src/components/faction/FactionDraft.tsx';
import { PhaseDock } from '../src/components/hud/PhaseDock.tsx';
import { ResourceBar } from '../src/components/hud/ResourceBar.tsx';
import { useGameStore } from '../src/game-store.ts';
import { empireSummary, endTurnOf, playerRail } from '../src/hud/hud-model.ts';
import { systemActions } from '../src/hud/system-actions.ts';
import { currentActor } from '../src/local-game.ts';
import { useSettingsStore } from '../src/settings-store.ts';
import { useDraftStore } from '../src/setup/draft-store.ts';
import { seatFactions, takenSeats } from '../src/setup/faction-draft.ts';
import { content, useGalaxyStore } from '../src/store.ts';
import { keepSecrets, pickAll, started, threePlayerLayout } from './game-helpers.ts';

beforeEach(() => {
  useGalaxyStore.setState({ language: 'de' });
  useSettingsStore.setState({ animations: false });
  useGameStore.getState().leave();
});

afterEach(cleanup);

const idOf = (index: number): string => FACTIONS[index]?.id ?? '';
const game = () => useGameStore.getState().game as GameState;
const homeOf = (state: GameState, player: PlayerId | null) =>
  Object.values(state.systems).find((system) =>
    system.spaceUnits.some((unit) => unit.owner === player),
  );

describe('Fraktionswahl vor der Partie', () => {
  it('RR 80: gewählte Fraktionen sitzen auf den ersten Plätzen, die KI bekommt die übrigen', () => {
    const order = seatFactions(FACTIONS, [idOf(3), idOf(1)]).map((faction) => faction.id);
    expect(order.slice(0, 2)).toEqual([idOf(3), idOf(1)]);
    expect(new Set(order).size).toBe(FACTIONS.length);
    expect(takenSeats([idOf(3), idOf(1)])).toEqual({ [idOf(3)]: 1, [idOf(1)]: 2 });
  });

  it('jeder Mensch wählt der Reihe nach; vergebene Fraktionen sind gesperrt, Zurück nimmt zurück', () => {
    threePlayerLayout();
    useGalaxyStore.setState({ botCount: 1 });
    useDraftStore.getState().begin();
    render(<FactionDraft />);
    expect(screen.getByText('P1 wählt eine Fraktion')).toBeTruthy();
    fireEvent.click(screen.getAllByRole('radio')[2] as HTMLElement);
    fireEvent.click(screen.getByRole('button', { name: 'Wählen' }));
    expect(screen.getByText('P2 wählt eine Fraktion')).toBeTruthy();
    expect(screen.getByText('P1')).toBeTruthy();
    useDraftStore.getState().show(idOf(2));
    expect(useDraftStore.getState().preview).not.toBe(idOf(2));
    fireEvent.click(screen.getByRole('button', { name: 'Zurück' }));
    expect(useDraftStore.getState()).toMatchObject({ picks: [], preview: idOf(2) });
  });

  it('nach dem letzten Menschen beginnt die Partie mit den gewählten Fraktionen', () => {
    threePlayerLayout();
    useGalaxyStore.setState({ botCount: 1 });
    useDraftStore.getState().begin();
    useDraftStore.getState().show(idOf(4));
    useDraftStore.getState().choose();
    useDraftStore.getState().show(idOf(5));
    useDraftStore.getState().choose();
    expect(useDraftStore.getState().open).toBe(false);
    expect(
      game()
        .players.map((player) => player.faction)
        .slice(0, 2),
    ).toEqual([idOf(4), idOf(5)]);
    expect(useGameStore.getState().bots).toHaveLength(1);
  });
});

describe('Anzeigen über der Karte', () => {
  it('RR 75: die Ressourcenleiste zählt die eigenen Planeten, Waren und Kommandomarker', () => {
    const state = keepSecrets(started());
    const actor = currentActor(state) as PlayerId;
    const summary = empireSummary(state, actor, content);
    expect(summary?.resources.ready).toBe(summary?.resources.total);
    expect(summary?.resources.total).toBeGreaterThan(0);
    expect(summary?.pools).toEqual({ tactic: 3, fleet: 3, strategy: 2 });
    render(<ResourceBar game={state} />);
    expect(screen.getByLabelText(/^Ressourcen: \d+\/\d+$/)).toBeTruthy();
    expect(screen.getByLabelText('Kommandomarker').textContent).toContain('3');
  });

  it('RR 3: die Spielerleiste folgt der Zugreihenfolge und markiert, wer am Zug ist', () => {
    const state = pickAll(started());
    const rail = playerRail(state);
    expect(rail.map((entry) => entry.id)).toEqual(state.actionPhase?.order);
    expect(rail.filter((entry) => entry.active)).toHaveLength(1);
    expect(rail.every((entry) => entry.initiatives.length === 2)).toBe(true);
  });

  it('RR 89: nach dem Aktivieren beendet „Zug beenden“ die taktische Aktion, erst wenn alles erledigt ist', () => {
    const state = pickAll(started());
    const actor = currentActor(state) as PlayerId;
    const home = homeOf(state, actor);
    if (home === undefined) throw new Error('kein Heimatsystem');
    expect(systemActions(state, actor, home.id, 7)).toEqual(['view', 'activate']);
    expect(systemActions(state, null, home.id, 7)).toEqual(['view']);
    useGameStore.getState().send({ type: 'ActivateSystem', issuedBy: actor, system: home.id });
    expect(endTurnOf(game(), actor)).toEqual({ kind: 'endTactical', ready: false });
    render(<PhaseDock game={game()} />);
    const end = screen.getByRole('button', { name: 'Zug beenden' });
    expect(end.hasAttribute('disabled')).toBe(true);
  });
});
