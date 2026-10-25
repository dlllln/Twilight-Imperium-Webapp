// @vitest-environment jsdom
import {
  findPlayer,
  type GameState,
  type PlanetId,
  planetId,
  type PlayerId,
  researchOptions,
  type TechnologyColor,
  type TechnologyId,
  updatePlayer,
} from '@stellar/domain';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { NoticeStack } from '../src/components/hud/NoticeStack.tsx';
import { PlayerSheet } from '../src/components/sheet/PlayerSheet.tsx';
import { ResearchSpread } from '../src/components/table/ResearchSpread.tsx';
import { useGameStore } from '../src/game-store.ts';
import { translate } from '../src/i18n.ts';
import { useHandStore } from '../src/hand/hand-store.ts';
import { useSettingsStore } from '../src/settings-store.ts';
import { content, useGalaxyStore } from '../src/store.ts';
import { useCarryStore } from '../src/table/carry-store.ts';
import { useDraftStore } from '../src/table/draft-store.ts';
import { cardOf, holding } from './card-form-helpers.tsx';
import { pickAll, started } from './game-helpers.ts';
import { leaveTable, seatTable } from './local-table.ts';

/*
 * Forschungsauslage (Tischansicht): Technologie primär und sekundär auf einem offenen
 * Kartentisch statt im Formular; gesperrte Karten nennen ihre fehlenden Farben, Planeten mit
 * Spezialisierung entsperren sie und verlassen dafür die Bezahlung.
 */

const store = () => useGameStore.getState();
const game = () => store().game as GameState;
const spread = () => screen.getByRole('region', { name: 'Forschungsauslage' });
const prompt = () => screen.getByRole('region', { name: 'Entscheidung' });
const owned = (player: PlayerId) => findPlayer(game(), player)?.technologies ?? [];
const EMPTY = { piece: null, legal: new Set<string>(), over: null, point: null, mode: null };

beforeEach(() => {
  leaveTable();
  useGalaxyStore.setState({ language: 'de' });
  useSettingsStore.setState({ animations: false, tableView: true });
  useCarryStore.setState({ ...EMPTY, news: null });
  useHandStore.getState().clear();
  useDraftStore.getState().clear();
});

afterEach(cleanup);

/** Pult, Ansage und Auslage, die dem Spielstand folgen. */
function Live(): ReactElement | null {
  const current = useGameStore((state) => state.game);
  if (current === null) return null;
  return (
    <>
      <PlayerSheet game={current} />
      <NoticeStack game={current} />
      <ResearchSpread game={current} />
    </>
  );
}

/** Der Aktive hat die Technologie aus der Hand gewählt und sitzt am Bildschirm. */
function choosing(): PlayerId {
  const { player, card } = holding('technology');
  seatTable(game(), { me: player });
  useHandStore.getState().choose({ player, card: card.id });
  return player;
}

type Change = (state: GameState, me: PlayerId) => GameState;

/** Ein Mitspieler folgt der Technologie des Aktiven; er sitzt am Bildschirm. */
function following(change: Change = (state) => state): PlayerId {
  const state = pickAll(started());
  const turn = state.actionPhase as NonNullable<GameState['actionPhase']>;
  const me = state.players.find((player) => player.id !== turn.active)?.id as PlayerId;
  const secondary = { card: cardOf('technology').id, awaiting: [me], free: [] };
  seatTable(change({ ...state, actionPhase: { ...turn, secondary } }, me), { me });
  return me;
}

const withGoods =
  (tradeGoods: number): Change =>
  (state, me) =>
    updatePlayer(state, me, (player) => ({ ...player, tradeGoods }));

/** Planeten des Spielplans mit Spezialisierung und Ressourcen (sie könnten auch bezahlen). */
const SPECIALTIES: ReadonlyMap<string, TechnologyColor> = new Map(
  content.tiles
    .all()
    .flatMap((tile) => tile.planets)
    .flatMap((planet) => {
      const color = planet.technologySpecialty;
      return color === undefined || planet.resources === 0 ? [] : [[planet.id, color] as const];
    }),
);

interface Unlock {
  readonly state: GameState;
  readonly planet: PlanetId;
  readonly technology: TechnologyId;
}

/** Der Spieler hält einen bereiten Planeten, dessen Spezialisierung genau eine Farbe ersetzt. */
function unlockFor(state: GameState, me: PlayerId): Unlock {
  for (const [id, color] of SPECIALTIES) {
    const planet = state.planets[id];
    if (planet === undefined) continue;
    const held = { ...planet, controller: me, exhausted: false };
    const next = { ...state, planets: { ...state.planets, [id]: held } };
    const options = researchOptions(next, me, content, { technologies: [], specialties: [] });
    const match = options.find((o) => o.missing.length === 1 && o.missing[0] === color);
    if (match !== undefined)
      return { state: next, planet: planetId(id), technology: match.technology.id };
  }
  throw new Error('keine passende Spezialisierung');
}

const cardInput = (technology: TechnologyId) =>
  spread().querySelector<HTMLInputElement>(`[data-tech="${technology}"] input`);

const openInputs = () => [
  ...spread().querySelectorAll<HTMLInputElement>('[data-state="open"] input'),
];

/** Zwei offene Karten, von denen die zweite die Farbe der ersten als Voraussetzung braucht. */
function prerequisitePair(me: PlayerId): readonly [TechnologyId, TechnologyId] {
  const none = { technologies: [], specialties: [] };
  const open = researchOptions(game(), me, content, none).filter((o) => o.missing.length === 0);
  const ids = new Set(open.map((o) => o.technology.id));
  for (const first of open) {
    const choice = { technologies: [first.technology.id], specialties: [] };
    const next = researchOptions(game(), me, content, choice).find(
      (o) => o.missing.length === 0 && !ids.has(o.technology.id),
    );
    if (next !== undefined) return [first.technology.id, next.technology.id];
  }
  throw new Error('kein Paar mit Voraussetzung');
}

const offered = (planet: PlanetId) =>
  document.querySelector(`.planet-row [role="checkbox"][data-planet="${planet}"]`);

describe('Forschungsauslage (Tischansicht)', () => {
  it('Technologie: die Auslage erscheint statt des Formulars, das Siegel heißt Erforschen', () => {
    choosing();
    render(<Live />);
    expect(spread().dataset['ability']).toBe('primary');
    expect(document.querySelector('.technology-form')).toBeNull();
    expect(spread().querySelector('.card-table-kicker')?.textContent).toContain('Gewählt: 0 / 2');
    const seal = within(prompt()).getByRole<HTMLButtonElement>('button', { name: 'Erforschen' });
    expect(seal.disabled).toBe(true);
    expect(openInputs().length).toBeGreaterThan(0);
  });

  it('gesperrte Karten sind nicht wählbar und nennen die fehlenden Farben', () => {
    choosing();
    render(<Live />);
    const locked = spread().querySelector<HTMLElement>('.tech-option.locked');
    if (locked === null) throw new Error('keine gesperrte Karte');
    expect(locked.dataset['state']).toBe('locked');
    const input = locked.querySelector('input') as HTMLInputElement;
    expect(input.disabled).toBe(true);
    fireEvent.click(input);
    expect(input.checked).toBe(false);
    const state = locked.querySelector('.research-card-state')?.textContent ?? '';
    expect(state).toMatch(/^Voraussetzungen fehlen: /);
    const dots = locked.querySelectorAll('.prerequisites .tech-dot.missing');
    expect(dots.length).toBeGreaterThan(0);
    const named = [...dots].map((dot) => dot.getAttribute('title') ?? '?');
    for (const color of named) expect(state).toContain(color);
  });

  it('eine Spezialisierung entsperrt die Karte und fehlt danach in der Planetenreihe', () => {
    const found: { unlock?: Unlock } = {};
    following((state, me) => {
      found.unlock = unlockFor(state, me);
      return found.unlock.state;
    });
    if (found.unlock === undefined) throw new Error('keine Spezialisierung');
    const { planet, technology } = found.unlock;
    render(<Live />);
    expect(cardInput(technology)?.disabled).toBe(true);
    const skip = within(spread()).getByRole('checkbox', { name: /^Spezialisierung nutzen: / });
    // Der Name nennt die Farbe, die der Planet ersetzt.
    const color = translate('de', SPECIALTIES.get(planet) as TechnologyColor);
    expect(skip.getAttribute('aria-label')).toMatch(new RegExp(`\\(${color}\\)$`));
    fireEvent.click(skip);
    expect(cardInput(technology)?.disabled).toBe(false);
    fireEvent.click(cardInput(technology) as HTMLInputElement);
    expect(cardInput(technology)?.checked).toBe(true);
    expect(document.querySelector('.planet-row [role="checkbox"]')).not.toBeNull();
    expect(offered(planet)).toBeNull();
    fireEvent.click(skip);
    expect(offered(planet)).not.toBeNull();
  });

  it('primär: die zweite Technologie öffnet die Bezahlung, danach sind weitere Karten gesperrt', () => {
    choosing();
    render(<Live />);
    fireEvent.click(openInputs()[0] as HTMLInputElement);
    expect(screen.queryByTestId('paid')).toBeNull();
    expect(document.querySelector('.planet-row [role="checkbox"]')).toBeNull();
    fireEvent.click(openInputs()[0] as HTMLInputElement);
    expect(screen.getByTestId('paid').textContent).toBe('0');
    expect(document.querySelector('.planet-row [role="checkbox"]')).not.toBeNull();
    expect(openInputs()).toHaveLength(0);
    const full = [...spread().querySelectorAll<HTMLInputElement>('[data-state="full"] input')];
    expect(full.length).toBeGreaterThan(0);
    expect(full.every((input) => input.disabled)).toBe(true);
    expect(spread().querySelectorAll('[data-state="chosen"]')).toHaveLength(2);
  });

  it('primär: geht die Voraussetzung zurück, nennen Karte und Messleiste die fehlende Farbe', () => {
    const me = choosing();
    const [first, second] = prerequisitePair(me);
    render(<Live />);
    fireEvent.click(cardInput(first) as HTMLInputElement);
    fireEvent.click(cardInput(second) as HTMLInputElement);
    fireEvent.click(cardInput(first) as HTMLInputElement);
    const card = spread().querySelector<HTMLElement>(`[data-tech="${second}"]`);
    expect(card?.dataset['state']).toBe('chosen');
    const state = card?.querySelector('.research-card-state')?.textContent ?? '';
    expect(state).toMatch(/^Gewählt – Voraussetzungen fehlen: /);
    expect(screen.getByTestId('research-unmet').textContent).toMatch(
      /^Voraussetzungen fehlen für /,
    );
    const seal = within(prompt()).getByRole<HTMLButtonElement>('button', { name: 'Erforschen' });
    expect(seal.disabled).toBe(true);
  });

  it('gesperrte Karten liegen am Ende ihrer Spalte', () => {
    choosing();
    render(<Live />);
    for (const column of spread().querySelectorAll('.research-column')) {
      const states = [...column.querySelectorAll<HTMLElement>('[data-state]')].map(
        (card) => card.dataset['state'],
      );
      const firstLocked = states.indexOf('locked');
      if (firstLocked >= 0)
        expect(states.slice(firstLocked).every((s) => s === 'locked')).toBe(true);
    }
  });

  it('sekundär: der Sockel löst erst nach Auswahl und Bezahlung aus', () => {
    const me = following(withGoods(4));
    const strategy = findPlayer(game(), me)?.commandPools.strategy ?? 0;
    render(<Live />);
    expect(spread().dataset['ability']).toBe('secondary');
    const socket = () => screen.queryByRole('button', { name: /^Sekundärfähigkeit nutzen/ });
    expect(socket()).toBeNull();
    expect(prompt().textContent).toContain('Triff erst deine Wahl am Tisch');
    const input = openInputs()[0] as HTMLInputElement;
    const technology = input.closest<HTMLElement>('[data-tech]')?.dataset['tech'] as TechnologyId;
    fireEvent.click(input);
    expect(socket()).toBeNull();
    for (let coin = 0; coin < 4; coin += 1)
      fireEvent.click(screen.getByRole('button', { name: 'Kasse +' }));
    fireEvent.click(socket() as HTMLElement);
    expect(store().error).toBeNull();
    expect(owned(me)).toContain(technology);
    expect(findPlayer(game(), me)?.commandPools.strategy).toBe(strategy - 1);
    expect(screen.queryByRole('region', { name: 'Forschungsauslage' })).toBeNull();
  });

  it('klassische Ansicht: keine Auslage, das Formular bleibt', () => {
    useSettingsStore.setState({ tableView: false });
    choosing();
    render(<Live />);
    expect(screen.queryByRole('region', { name: 'Forschungsauslage' })).toBeNull();
    expect(document.querySelector('.technology-form')).not.toBeNull();
  });
});
