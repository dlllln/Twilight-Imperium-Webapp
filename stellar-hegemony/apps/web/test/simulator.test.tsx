// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from '../src/App.tsx';
import { seriesScore } from '../src/simulator/simulator-rules.ts';
import { useSimulatorStore } from '../src/simulator/simulator-store.ts';
import { useSettingsStore } from '../src/settings-store.ts';
import { useGalaxyStore } from '../src/store.ts';
import { installDomPolyfills } from './dom-polyfills.ts';

installDomPolyfills();

/** Sicherung gegen Endlosschleifen: so viele Runden dauert kein Kampf. */
const MAX_ROUNDS = 40;

beforeEach(() => {
  localStorage.clear();
  useGalaxyStore.setState({ language: 'de' });
  useSettingsStore.setState({ animations: false });
  useSimulatorStore.setState({ stage: 'closed', seed: 7 });
});

afterEach(() => cleanup());

const simulator = () => screen.getByRole('dialog', { name: 'Kampfsimulator' });

const more = (ship: string) =>
  within(screen.getByRole('listitem', { name: ship })).getByRole('button', { name: 'Mehr' });

function openAndChoose(faction: string) {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'Kampfsimulator' }));
  fireEvent.click(within(simulator()).getByRole('radio', { name: faction }));
  fireEvent.click(screen.getByRole('button', { name: 'Wählen' }));
}

function buildFleet() {
  for (const [ship, count] of [
    ['Schlachtschiff', 2],
    ['Kreuzer', 2],
    ['Träger', 1],
    ['Jäger', 2],
  ] as const)
    for (let step = 0; step < count; step += 1) fireEvent.click(more(ship));
}

function fightToTheEnd(): string {
  for (let round = 0; round < MAX_ROUNDS; round += 1) {
    const result = screen.queryByRole('alert');
    if (result !== null) return within(result).getByRole('heading').textContent;
    fireEvent.click(screen.getByRole('button', { name: 'Feuer!' }));
  }
  throw new Error('Der Kampf endet nicht');
}

describe('Kampfsimulator', () => {
  it('Fraktion wählen zeigt Komplexität, Fähigkeiten und eigenen Hintergrund', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Kampfsimulator' }));
    fireEvent.click(within(simulator()).getByRole('radio', { name: 'Dominion Karth' }));
    expect(screen.getByRole('heading', { name: 'Dominion Karth' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Baronie Letnev' }).getAttribute('src')).toBe(
      '/ti4/factions/letnev-back.jpg',
    );
    expect(screen.getByText('Twilight Imperium · Baronie Letnev')).toBeTruthy();
    expect(screen.getByLabelText(/Komplexität/)).toBeTruthy();
    expect(screen.getByText('Schwere Panzerung')).toBeTruthy();
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Hintergrund' }));
    expect(screen.getByRole('tabpanel').textContent.length).toBeGreaterThan(20);
  });

  it('die Werft prüft Flotte, Ressourcen und Produktionslimit', () => {
    openAndChoose('Dominion Karth');
    const launch = screen.getByRole('button', { name: 'Kampf!' });
    expect(launch).toHaveProperty('disabled', true);
    expect(screen.getByText('Baue mindestens ein Kriegsschiff.')).toBeTruthy();
    fireEvent.click(more('Jäger'));
    expect(screen.getByText(/Jäger brauchen Platz/)).toBeTruthy();
    fireEvent.click(more('Träger'));
    expect(launch).toHaveProperty('disabled', false);
    for (let step = 0; step < 4; step += 1) fireEvent.click(more('Sonnenbrecher'));
    expect(screen.getByText(/Ressourcen/)).toBeTruthy();
  });

  it('Kampf: Feuer bis zum Ergebnis, dann der nächste Kampf der Serie', () => {
    openAndChoose('Dominion Karth');
    buildFleet();
    fireEvent.click(screen.getByRole('button', { name: 'Kampf!' }));
    expect(screen.getByText('Raumkampf')).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Angreifer' }).textContent).toContain(
      'Dominion Karth',
    );
    expect(screen.getByTestId('fleet-you').textContent).toContain('2 Schlachtschiff');
    expect(['Sieg', 'Niederlage', 'Unentschieden']).toContain(fightToTheEnd());
    expect(useSimulatorStore.getState().results).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Nächster Kampf' }));
    expect(screen.getByRole('button', { name: 'Kampf!' })).toBeTruthy();
  });

  it('eine Taktikkarte gilt für eine Runde und verlässt danach die Hand', () => {
    openAndChoose('Handelsbund von Sel');
    buildFleet();
    fireEvent.click(screen.getByRole('button', { name: 'Kampf!' }));
    const card = screen.getByRole('button', { name: /Überladung/ });
    fireEvent.click(card);
    expect(card.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Feuer!' }));
    expect(screen.queryByRole('button', { name: /Überladung/ })).toBeNull();
    const hand = useSimulatorStore.getState().battle?.attacker.hand;
    expect(hand).toEqual(['focused-fire', 'emergency-shields', 'field-repairs']);
  });

  it('nach drei Kämpfen ist die Serie entschieden; Escape verlässt den Simulator', () => {
    expect(seriesScore(['sim-you', 'sim-you'] as never).over).toBe(true);
    expect(seriesScore(['sim-you', null] as never).over).toBe(false);
    openAndChoose('Dominion Karth');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Kampfsimulator' })).toBeNull();
  });
});
