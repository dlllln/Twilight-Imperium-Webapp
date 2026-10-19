// @vitest-environment jsdom
import { seatPlayerId } from '@stellar/application';
import {
  currentActor,
  type GameEvent,
  type GameState,
  leadersOf,
  type PlayerId,
} from '@stellar/domain';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LeadersPanel } from '../src/components/exploration/LeadersPanel.tsx';
import { HandDock } from '../src/components/hand/HandDock.tsx';
import { HistoryPanel } from '../src/components/history/HistoryPanel.tsx';
import { useGameStore } from '../src/game-store.ts';
import { tableEntries } from '../src/hand/hand-model.ts';
import { useHandStore } from '../src/hand/hand-store.ts';
import { appendHistory } from '../src/history/turn-history.ts';
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

function Live(): ReactElement | null {
  const current = useGameStore((state) => state.game);
  return current === null ? null : <HandDock game={current} />;
}

/** Aktionsphase, der Bildschirm gehört dem Spieler am Zug. */
function actionTurn(): PlayerId {
  const state = pickAll(started());
  const actor = currentActor(state) as PlayerId;
  seatTable(state, { me: actor });
  return actor;
}

const leaderOf = (player: PlayerId, kind: string) =>
  leadersOf(game(), player, content).find((leader) => leader.kind === kind);

describe('PoK Anführer in Hand und Übersicht', () => {
  it('PoK Agent: liegt bereit in der Hand, wird beim Ausspielen erschöpft', () => {
    const actor = actionTurn();
    const agent = leaderOf(actor, 'agent');
    if (agent === undefined) throw new Error('kein Agent');
    const input = { game: game(), actor, viewer: actor, selected: null, choosing: false };
    const leaders = tableEntries(input).filter((entry) => entry.kind === 'leader');
    expect(leaders).toEqual([expect.objectContaining({ playable: true })]);
    render(<Live />);
    fireEvent.click(screen.getByTestId(`leader-${agent.id}`));
    expect(leaderOf(actor, 'agent')?.status).not.toBe('exhausted');
    fireEvent.click(screen.getByTestId(`leader-${agent.id}`));
    expect(leaderOf(actor, 'agent')?.status).toBe('exhausted');
  });

  it('PoK Kommandant und Held: gesperrt mit Bedingung und Fortschritt, für alle sichtbar', () => {
    const actor = actionTurn();
    const commander = leaderOf(actor, 'commander');
    const hero = leaderOf(actor, 'hero');
    render(<LeadersPanel game={game()} />);
    expect(screen.getByText('Anführer')).toBeTruthy();
    const row = screen.getByTestId(`leader-${String(commander?.id)}`);
    expect(row.textContent).toMatch(/gesperrt \d+\/\d+/);
    expect(screen.getByTestId(`leader-${String(hero?.id)}`).textContent).toContain('gesperrt 0/3');
    expect(screen.getAllByText('Agent')).toHaveLength(game().players.length);
  });

  it('der Verlauf nennt freigeschaltete und eingesetzte Anführer beim Namen', () => {
    const state = started();
    seatTable(state);
    const player = seatPlayerId(0);
    const hero = leadersOf(state, player, content).find((leader) => leader.kind === 'hero');
    const events = [
      { type: 'LeaderUnlocked', player, leader: hero?.id },
      { type: 'LeaderUsed', player, leader: hero?.id, purged: true },
    ] as unknown as GameEvent[];
    useGameStore.setState({ history: appendHistory([], events) });
    render(<HistoryPanel game={game()} />);
    expect(screen.getByText(/schaltet .+ frei/)).toBeTruthy();
    expect(screen.getByText(/setzt .+ ein/)).toBeTruthy();
  });
});
