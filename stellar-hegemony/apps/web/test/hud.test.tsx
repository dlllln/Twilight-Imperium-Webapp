// @vitest-environment jsdom
import { TI4_FACTIONS as FACTIONS } from '@stellar/content';
import { type LobbyView, seatPlayerId } from '@stellar/application';
import type { GameState, PlayerId } from '@stellar/domain';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FactionDraft } from '../src/components/faction/FactionDraft.tsx';
import { PhaseDock } from '../src/components/hud/PhaseDock.tsx';
import { ResourceBar } from '../src/components/hud/ResourceBar.tsx';
import { useGameStore } from '../src/game-store.ts';
import { empireSummary, endTurnOf, playerRail } from '../src/hud/hud-model.ts';
import { systemActions } from '../src/hud/system-actions.ts';
import { currentActor } from '@stellar/domain';
import { useSettingsStore } from '../src/settings-store.ts';
import { suggestion, takenSeats, useFactionPick } from '../src/setup/faction-draft.ts';
import { useOnlineStore } from '../src/online/online-store.ts';
import { content, useGalaxyStore } from '../src/store.ts';
import { keepSecrets, pickAll, started } from './game-helpers.ts';

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

describe('Fraktionswahl in der Lobby', () => {
  const seats: LobbyView['seats'] = [
    { seat: 0, kind: 'human', name: 'Anna', faction: idOf(3), connected: true },
    { seat: 1, kind: 'human', name: 'Ben', faction: null, connected: true },
    { seat: 2, kind: 'open', name: null, faction: idOf(0), connected: false },
  ];

  it('RR 80: was andere gewählt haben, ist mit ihrem Platz gesperrt; die eigene Wahl nicht', () => {
    expect(takenSeats(seats, 1)).toEqual({ [idOf(3)]: 1, [idOf(0)]: 3 });
    expect(takenSeats(seats, 0)).toEqual({ [idOf(0)]: 3 });
    expect(suggestion(FACTIONS, seats, 0)).toBe(idOf(3));
    expect(suggestion(FACTIONS, seats, 1)).toBe(idOf(1));
  });

  it('jeder wählt auf seinem Gerät; gesperrte Fraktionen lassen sich nicht ansehen, Wählen schickt die Wahl', async () => {
    const chosen: string[] = [];
    useOnlineStore.setState({
      ticket: { code: 'QX7K2M', token: 't', seat: 1, player: seatPlayerId(1) },
      lobby: { code: 'QX7K2M', started: false, seats },
      chooseFaction: (faction) => (chosen.push(faction), Promise.resolve(true)),
    });
    useFactionPick.getState().begin(suggestion(FACTIONS, seats, 1));
    render(<FactionDraft />);
    expect(screen.getByText('P2 wählt eine Fraktion')).toBeTruthy();
    expect(screen.getByText('P1')).toBeTruthy();
    fireEvent.click(screen.getAllByRole('radio')[3] as HTMLElement);
    expect(useFactionPick.getState().preview).toBe(idOf(1));
    fireEvent.click(screen.getAllByRole('radio')[2] as HTMLElement);
    fireEvent.click(screen.getByRole('button', { name: 'Wählen' }));
    await act(() => Promise.resolve());
    expect(chosen).toEqual([idOf(2)]);
    expect(useFactionPick.getState().open).toBe(false);
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
    expect(systemActions(state, actor, home.id)).toEqual(['view', 'activate']);
    expect(systemActions(state, null, home.id)).toEqual(['view']);
    useGameStore.getState().send({ type: 'ActivateSystem', issuedBy: actor, system: home.id });
    expect(endTurnOf(game(), actor)).toEqual({ kind: 'endTactical', ready: false });
    render(<PhaseDock game={game()} />);
    const end = screen.getByRole('button', { name: 'Zug beenden' });
    expect(end.hasAttribute('disabled')).toBe(true);
  });
});
