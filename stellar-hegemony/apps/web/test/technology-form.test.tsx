// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  findPlayer,
  type GameState,
  type PlanetId,
  planetId,
  type PlayerId,
  researchOptions as domainOptions,
  type TechnologyColor,
  type TechnologyId,
} from '@stellar/domain';
import { afterEach, describe, expect, it } from 'vitest';
import { TechnologyPanel } from '../src/components/technology/TechnologyPanel.tsx';
import { useGameStore } from '../src/game-store.ts';
import { planetLabel, technologyLabel } from '../src/labels.ts';
import { content } from '../src/store.ts';
import { researchOptions } from '../src/technology-view.ts';
import { holding, Live } from './card-form-helpers.tsx';

afterEach(cleanup);

const store = () => useGameStore.getState();
const game = () => store().game as GameState;
const owned = (player: PlayerId) => findPlayer(game(), player)?.technologies ?? [];

/** Erforschbare Technologien ohne fehlende Voraussetzungen. */
const ready = (player: PlayerId): readonly TechnologyId[] =>
  researchOptions(game(), player, content)
    .filter((option) => option.missing.length === 0)
    .map((option) => option.technology.id);

const box = (id: TechnologyId) =>
  screen.getByRole('checkbox', { name: new RegExp(technologyLabel(id, 'de')) });

const withGoods = (player: PlayerId, tradeGoods: number) =>
  useGameStore.setState({
    game: {
      ...game(),
      players: game().players.map((p) => (p.id === player ? { ...p, tradeGoods } : p)),
    },
  });

/** Planeten des Spielplans mit Spezialisierung. */
const SPECIALTIES: ReadonlyMap<string, TechnologyColor> = new Map(
  content.tiles
    .all()
    .flatMap((tile) => tile.planets)
    .flatMap((planet) =>
      planet.technologySpecialty === undefined
        ? []
        : [[planet.id, planet.technologySpecialty] as const],
    ),
);

/**
 * Der Spieler hält einen bereiten Planeten, dessen Spezialisierung einer Technologie genau die
 * eine fehlende Farbe ersetzt; der Spielstand im Store bekommt ihn.
 */
function holdSpecialty(player: PlayerId): { planet: PlanetId; technology: TechnologyId } {
  for (const [id, color] of SPECIALTIES) {
    const planet = game().planets[id];
    if (planet === undefined) continue;
    const held = { ...planet, controller: player, exhausted: false };
    const next = { ...game(), planets: { ...game().planets, [id]: held } };
    const options = domainOptions(next, player, content, { technologies: [], specialties: [] });
    const match = options.find((o) => o.missing.length === 1 && o.missing[0] === color);
    if (match === undefined) continue;
    useGameStore.setState({ game: next });
    return { planet: planetId(id), technology: match.technology.id };
  }
  throw new Error('keine passende Spezialisierung');
}

describe('Technologie im Browser (RR 81)', () => {
  it('klassisch: gesperrte Technologien sind nicht wählbar, eine Spezialisierung entsperrt sie', () => {
    const { player, card } = holding('technology');
    const { planet, technology } = holdSpecialty(player);
    render(<Live player={player} card={card} ability="primary" />);
    const locked = box(technology) as HTMLInputElement;
    expect(locked.closest('.tech-option')?.classList.contains('locked')).toBe(true);
    expect(locked.disabled).toBe(true);
    fireEvent.click(screen.getByRole('checkbox', { name: new RegExp(planetLabel(planet, 'de')) }));
    expect((box(technology) as HTMLInputElement).disabled).toBe(false);
    expect(box(technology).closest('.tech-option')?.classList.contains('locked')).toBe(false);
    fireEvent.click(box(technology));
    fireEvent.click(screen.getByRole('button', { name: 'Erforschen' }));
    expect(store().error).toBeNull();
    expect(owned(player)).toContain(technology);
  });

  it('RR 81.2: primär eine Technologie kostenlos, eine zweite erst nach Bezahlung', () => {
    const { player, card } = holding('technology');
    const [first, second, third] = ready(player) as TechnologyId[];
    render(<Live player={player} card={card} ability="primary" />);
    fireEvent.click(box(first as TechnologyId));
    expect(screen.queryByTestId('paid')).toBeNull();
    fireEvent.click(box(second as TechnologyId));
    expect(screen.getByText('/ 6', { exact: false })).toBeDefined();
    expect((box(third as TechnologyId) as HTMLInputElement).disabled).toBe(true);
    fireEvent.click(box(second as TechnologyId));
    fireEvent.click(screen.getByRole('button', { name: 'Erforschen' }));
    expect(store().error).toBeNull();
    expect(owned(player)).toContain(first);
  });

  it('RR 81.3: sekundär eine Technologie für 4 Ressourcen', () => {
    const { player, card } = holding('technology');
    render(<Live player={player} card={card} ability="primary" />);
    fireEvent.click(box(ready(player)[0] as TechnologyId));
    fireEvent.click(screen.getByRole('button', { name: 'Erforschen' }));
    cleanup();
    const next = game().actionPhase?.secondary?.awaiting[0] as PlayerId;
    withGoods(next, 4);
    const pick = ready(next)[0] as TechnologyId;
    render(<Live player={next} card={card} ability="secondary" />);
    fireEvent.click(box(pick));
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '4' } });
    fireEvent.click(screen.getByRole('button', { name: 'Erforschen' }));
    expect(store().error).toBeNull();
    expect(owned(next)).toContain(pick);
    expect(findPlayer(game(), next)?.tradeGoods).toBe(0);
  });

  it('Erforschen bleibt gesperrt, solange zu wenig bezahlt ist', () => {
    const { player, card } = holding('technology');
    render(<Live player={player} card={card} ability="primary" />);
    fireEvent.click(box(ready(player)[0] as TechnologyId));
    fireEvent.click(screen.getByRole('button', { name: 'Erforschen' }));
    cleanup();
    const next = game().actionPhase?.secondary?.awaiting[0] as PlayerId;
    withGoods(next, 4);
    render(<Live player={next} card={card} ability="secondary" />);
    const research = () => screen.getByRole<HTMLButtonElement>('button', { name: 'Erforschen' });
    expect(research().disabled).toBe(true);
    fireEvent.click(box(ready(next)[0] as TechnologyId));
    expect(research().disabled).toBe(true);
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '3' } });
    expect(research().disabled).toBe(true);
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '4' } });
    expect(research().disabled).toBe(false);
  });

  it('RR 80.1: die Technologien aller Spieler liegen offen aus', () => {
    holding('technology');
    render(<TechnologyPanel game={game()} />);
    const starting = game().players.flatMap((p) => p.technologies);
    expect(starting.length).toBeGreaterThan(0);
    for (const id of starting)
      expect(screen.getAllByText(technologyLabel(id, 'de')).length).toBeGreaterThan(0);
  });
});
