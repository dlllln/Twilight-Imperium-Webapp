// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { GameState, PlayerId } from '@stellar/domain';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TurnPanel } from '../src/components/game/TurnPanel.tsx';
import { HandDock } from '../src/components/hand/HandDock.tsx';
import { useGameStore } from '../src/game-store.ts';
import { handEntries } from '../src/hand/hand-model.ts';
import { useHandStore } from '../src/hand/hand-store.ts';
import { currentActor } from '@stellar/domain';
import { useSettingsStore } from '../src/settings-store.ts';
import { useGalaxyStore } from '../src/store.ts';
import { keepSecrets, pickAll, started } from './game-helpers.ts';

beforeEach(() => {
  useGalaxyStore.setState({ language: 'de' });
  useSettingsStore.setState({ animations: false });
  useHandStore.getState().clear();
  useGameStore.setState({ selected: null });
});

afterEach(cleanup);

const game = () => useGameStore.getState().game as GameState;
const card = (name: string | RegExp) => screen.getAllByRole('button', { name })[0] as HTMLElement;
const picks = () => document.querySelectorAll('.hand-card[data-kind="pick"]');

/** Zug und Hand, die dem Spielstand folgen. */
function Live(): ReactElement | null {
  const current = useGameStore((state) => state.game);
  if (current === null) return null;
  return (
    <>
      <TurnPanel game={current} />
      <HandDock game={current} />
    </>
  );
}

describe('Hand am unteren Rand', () => {
  it('RR 83: in der Strategiephase liegen die freien Strategiekarten auf der Hand', async () => {
    keepSecrets(started());
    render(<Live />);
    const actor = currentActor(game()) as PlayerId;
    expect(picks()).toHaveLength(8);
    fireEvent.click(card('Politik'));
    const politics = Object.values(game().strategyCards).find((entry) => entry.initiative === 3);
    expect(politics?.holder).toBe(actor);
    await waitFor(() => expect(picks()).toHaveLength(7));
  });

  it('eingeklappt, solange man sie nicht braucht; zur Kartenwahl offen, der Knopf klappt um', () => {
    useSettingsStore.setState({ handOpen: false });
    keepSecrets(started());
    render(<Live />);
    const dock = screen.getByRole('region', { name: 'Deine Hand' });
    expect(dock.className).toContain('raised');
    cleanup();
    pickAll(started());
    render(<Live />);
    const tucked = screen.getByRole('region', { name: 'Deine Hand' });
    expect(tucked.className).toContain('tucked');
    fireEvent.click(screen.getByRole('button', { name: 'Hand ausklappen' }));
    expect(tucked.className).toContain('raised');
    expect(useSettingsStore.getState().handOpen).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Hand einklappen' }));
    expect(tucked.className).toContain('tucked');
  });

  it('RR 3: im Zug liegen strategische Aktion, taktische Aktion und Passen bereit', () => {
    pickAll(started());
    render(<Live />);
    expect(card(/Strategische Aktion/)).toBeTruthy();
    expect(card('Passen').getAttribute('aria-disabled')).toBe('true');
    expect(card(/Taktische Aktion/).getAttribute('aria-disabled')).toBe('true');
    expect(screen.getByText('Wähle zuerst ein System auf der Karte.')).toBeTruthy();
  });

  it('RR 89: die taktische Aktion aktiviert das auf der Karte gewählte System', async () => {
    pickAll(started());
    const actor = currentActor(game()) as PlayerId;
    const home = Object.values(game().systems).find((system) =>
      system.spaceUnits.some((unit) => unit.owner === actor),
    );
    render(<Live />);
    act(() => useGameStore.getState().select(home?.id ?? null));
    expect(screen.getByText(/^Gewählt:/)).toBeTruthy();
    fireEvent.click(card(/Taktische Aktion/));
    expect(useGameStore.getState().error).toBeNull();
    expect(game().actionPhase?.tactical?.system).toBe(home?.id);
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Passen' })).toBeNull());
  });

  it('die strategische Aktion öffnet ihr Formular in der Seitenleiste; Zurück legt sie zurück', async () => {
    pickAll(started());
    render(<Live />);
    fireEvent.click(card(/Strategische Aktion/));
    expect(screen.getByRole('button', { name: 'Ausführen' })).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Passen' })).toBeNull());
    fireEvent.click(screen.getByRole('button', { name: 'Zurück' }));
    expect(card('Passen')).toBeTruthy();
  });

  it('RR 12: wer noch geheime Aufträge wählt, bekommt keine Zugkarten (der Agent liegt nur da)', () => {
    const fresh = started();
    const actor = currentActor(fresh);
    const entries = handEntries({
      game: fresh,
      actor,
      viewer: actor,
      selected: null,
      choosing: false,
    });
    expect(entries.filter((entry) => entry.kind !== 'leader')).toEqual([]);
    expect(entries.some((entry) => entry.playable)).toBe(false);
  });
});
