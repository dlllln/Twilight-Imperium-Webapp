// @vitest-environment jsdom
import {
  type GameState,
  type PlanetId,
  type PlayerId,
  productionChoices,
  type SystemId,
  type Unit,
  unitId,
  unitTypeId,
  updatePlayer,
} from '@stellar/domain';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { type ReactElement, useMemo } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { homeSystemOf } from '../src/card-view.ts';
import { HexTargets } from '../src/components/map/HexTargets.tsx';
import { useSitePicking } from '../src/components/map/use-picking.ts';
import { NoticeStack } from '../src/components/hud/NoticeStack.tsx';
import { CarryAnnouncer } from '../src/components/table/CarryAnnouncer.tsx';
import { useGameStore } from '../src/game-store.ts';
import { useHandStore } from '../src/hand/hand-store.ts';
import { planetLabel, unitLabel } from '../src/labels.ts';
import { FLAT_VIEW } from '../src/render/board-view.ts';
import { gameScene } from '../src/render/scene-model.ts';
import { useSettingsStore } from '../src/settings-store.ts';
import { content, DEFAULT_VIEWPORT, useGalaxyStore } from '../src/store.ts';
import { useCarryStore } from '../src/table/carry-store.ts';
import { useDraftStore } from '../src/table/draft-store.ts';
import { NO_PAYMENTS, usePaymentStore } from '../src/table/payment-store.ts';
import { GOODS_PIECE, KASSE, targetKey } from '../src/table/target-ref.ts';
import type { TableAction } from '../src/table/table-specs.ts';
import { useTableDecision } from '../src/table/use-table-decision.ts';
import { cardOf } from './card-form-helpers.tsx';
import { installDomPolyfills } from './dom-polyfills.ts';
import { pickAll, started } from './game-helpers.ts';
import { leaveTable, seatTable } from './local-table.ts';

installDomPolyfills();

const INFANTRY = unitTypeId('infantry');
const CARRIER = unitTypeId('carrier');
const BOUNDS = { minX: -1000, minY: -1000, width: 2000, height: 2000 };
const BAND = { top: 0, bottom: 2000 };

const store = () => useGameStore.getState();
const game = () => store().game as GameState;
const prompt = () => screen.getByRole('region', { name: 'Entscheidung' });
const yard = () => screen.getByTestId('shipyard');
const button = (name: string) => within(prompt()).getByRole<HTMLButtonElement>('button', { name });
const pieceOf = (type: string) =>
  yard().querySelector<HTMLElement>(`.shipyard-piece[data-unit="${type}"]`) as HTMLElement;
const figureOf = (type: string) =>
  within(yard()).getByRole<HTMLButtonElement>('button', {
    name: `Einheit aufnehmen: ${unitLabel(type, 'de')}`,
  });
const dock = () => yard().querySelector<HTMLElement>('.shipyard-dock') as HTMLElement;

beforeEach(() => {
  leaveTable();
  useGalaxyStore.setState({ language: 'de' });
  useSettingsStore.setState({ animations: false, tableView: true });
  const empty = { piece: null, legal: new Set<string>(), over: null, point: null, mode: null };
  useCarryStore.setState({ ...empty, news: null });
  useHandStore.getState().clear();
  useDraftStore.getState().clear();
  usePaymentStore.setState(NO_PAYMENTS);
});

afterEach(cleanup);

/** Eine Handlung am Entwurf, wie sie Pult und Kasse auslösen (Münze legen). */
function Acting(props: {
  readonly state: GameState;
  readonly label: string;
  readonly action: TableAction;
}): ReactElement {
  const decision = useTableDecision(props.state);
  return (
    <button type="button" onClick={() => decision?.act(props.action)}>
      {props.label}
    </button>
  );
}

/** Karte (Systeme und Planetenringe) und Ansage, die dem Spielstand folgen. */
function Table(props: {
  readonly map?: boolean;
  readonly actions?: Readonly<Record<string, TableAction>>;
}): ReactElement | null {
  const current = useGameStore((state) => state.game);
  const hexes = useMemo(
    () => (current === null ? [] : gameScene(current, content, 'de')),
    [current],
  );
  const site = useSitePicking(() => false);
  if (current === null) return null;
  const frame = { hexes, view: FLAT_VIEW, viewport: DEFAULT_VIEWPORT, bounds: BOUNDS };
  return (
    <>
      {props.map === true && (
        <HexTargets
          {...frame}
          band={BAND}
          onPick={() => undefined}
          onView={() => undefined}
          onSite={site}
        />
      )}
      <NoticeStack game={current} />
      <CarryAnnouncer game={current} />
      {Object.entries(props.actions ?? {}).map(([label, action]) => (
        <Acting key={label} state={current} label={label} action={action} />
      ))}
    </>
  );
}

const COIN: TableAction = { kind: 'tradeGoods', delta: 1 };

const figure = (id: string, type: string, owner: PlayerId): Unit => ({
  id: unitId(id),
  type: unitTypeId(type),
  owner,
  damaged: false,
});

type Change = (state: GameState, me: PlayerId, home: SystemId) => GameState;

interface Scene {
  readonly me: PlayerId;
  readonly home: SystemId;
}

/** Der Aktive steht im Schritt Produktion seiner taktischen Aktion daheim, mit Handelswaren. */
function producing(change: Change = (state) => state): Scene {
  const base = pickAll(started());
  const me = base.actionPhase?.active as PlayerId;
  const home = homeSystemOf(base, me, content) as SystemId;
  const tactical = {
    system: home,
    step: 'production',
    pendingHits: [],
    combat: null,
    windows: [],
    bonuses: [],
  } as const;
  const turn = base.actionPhase as NonNullable<GameState['actionPhase']>;
  const rich = updatePlayer(base, me, (p) => ({ ...p, tradeGoods: 10 }));
  seatTable(change({ ...rich, actionPhase: { ...turn, tactical } }, me, home), { me });
  return { me, home };
}

/** Ein freier Planet aus einem anderen System, ohne Einheiten. */
function freePlanet(state: GameState, home: SystemId): GameState['planets'][string] {
  const found = Object.values(state.planets).find(
    (planet) =>
      planet.controller === null &&
      planet.units.length === 0 &&
      state.systems[home]?.planetIds.includes(planet.id) === false,
  );
  if (found === undefined) throw new Error('kein freier Planet');
  return found;
}

/**
 * Die Heimat bekommt einen zweiten eigenen Planeten mit Orbitaldock (aus einem anderen System
 * hierher versetzt): Neue Bodentruppen haben die Wahl.
 */
const secondDock: Change = (state, me, home) => {
  const world = freePlanet(state, home);
  const moved = { ...world, controller: me, units: [figure('dock-2', 'orbitalDock', me)] };
  const systems = Object.fromEntries(
    Object.entries(state.systems).map(([id, system]) => {
      const rest = system.planetIds.filter((planet) => planet !== world.id);
      return [id, { ...system, planetIds: id === home ? [...rest, world.id] : rest }];
    }),
  );
  return { ...state, systems, planets: { ...state.planets, [world.id]: moved } };
};

/** Alle Träger des Vorrats stehen schon im Heimatsystem (RR 24.5). */
const allCarriers: Change = (state, me, home) => {
  const system = state.systems[home] as GameState['systems'][string];
  const limit = content.units.find(CARRIER)?.componentLimit as number;
  const others = system.spaceUnits.filter((unit) => unit.type !== CARRIER);
  const carriers = Array.from({ length: limit }, (_, at) =>
    figure(`t-${String(at)}`, 'carrier', me),
  );
  return {
    ...state,
    systems: { ...state.systems, [home]: { ...system, spaceUnits: [...others, ...carriers] } },
  };
};

const groundPlanets = (home: SystemId): readonly PlanetId[] =>
  (game().systems[home]?.planetIds ?? []).filter((id) =>
    game().planets[id]?.units.some((unit) => unit.type === 'orbitalDock'),
  );

const infantryOn = (planet: PlanetId): number =>
  game().planets[planet]?.units.filter((unit) => unit.type === INFANTRY).length ?? 0;

describe('Werft in der Ansage (Tischansicht)', () => {
  it('Werft: Infanterie + und Infanterie − ändern die Bestellung und gibt es nur einmal', () => {
    producing();
    render(<Table />);
    expect(within(yard()).getByRole('heading', { name: 'Produktion' })).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Infanterie +' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Infanterie −' })).toHaveLength(1);
    expect(button('Infanterie −').disabled).toBe(true);
    fireEvent.click(button('Infanterie +'));
    fireEvent.click(button('Infanterie +'));
    expect(pieceOf('infantry').dataset['ordered']).toBe('2');
    expect(screen.getByTestId('dock-count').textContent).toBe('2');
    expect(dock().querySelectorAll('.shipyard-berth.filled')).toHaveLength(2);
    expect(pieceOf('infantry').textContent).toContain('Kosten 1 je zwei');
    fireEvent.click(button('Infanterie −'));
    expect(pieceOf('infantry').dataset['ordered']).toBe('1');
    expect(screen.getByTestId('production-cost').textContent).toBe('1');
    expect(button('Produzieren').dataset['testid']).toBe('confirm');
    expect(button('Ohne Produktion weiter').classList.contains('table-prompt-alt')).toBe(true);
    expect(document.querySelector('.production-form')).toBeNull();
  });

  it('Werft: Plus ist gesperrt, sobald die Domain keine weitere Einheit zulässt', () => {
    const { me, home } = producing(allCarriers);
    render(<Table />);
    const carrier = unitLabel('carrier', 'de');
    expect(button(`${carrier} +`).disabled).toBe(true);
    expect(figureOf('carrier').disabled).toBe(true);
    expect(pieceOf('carrier').querySelector('.shipyard-supply')?.textContent).toBe('Vorrat: 0');
    for (let click = 0; click < 30 && !button('Infanterie +').disabled; click += 1)
      fireEvent.click(button('Infanterie +'));
    const ordered = Number(pieceOf('infantry').dataset['ordered']);
    const orders = [{ type: INFANTRY, count: ordered }];
    for (const choice of productionChoices(game(), home, me, orders, content)) {
      const name = unitLabel(choice.unit.id, 'de');
      expect(button(`${name} +`).disabled).toBe(!choice.canAdd);
      expect(choice.canAdd).toBe(false);
    }
  });

  it('Werft: Enter auf einer Einheit und Enter auf dem Dock bestellt sie', () => {
    const { home } = producing();
    render(<Table actions={{ Münze: COIN }} />);
    act(() => {
      fireEvent.click(figureOf('infantry'), { detail: 0 });
    });
    expect(figureOf('infantry').getAttribute('aria-pressed')).toBe('true');
    expect(dock().dataset['targetState']).toBe('legal');
    expect(document.activeElement).toBe(dock());
    fireEvent.keyDown(dock(), { key: 'Enter' });
    expect(pieceOf('infantry').dataset['ordered']).toBe('1');
    expect(useCarryStore.getState().piece).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Münze' }));
    const planet = groundPlanets(home)[0] as PlanetId;
    const before = infantryOn(planet);
    fireEvent.click(button('Produzieren'));
    expect(store().error).toBeNull();
    expect(infantryOn(planet)).toBe(before + 1);
  });

  it('Werft: eine auf einen Planeten gelegte Infanterie setzt den Planeten der Bodentruppen', () => {
    const { home } = producing(secondDock);
    const [first, second] = groundPlanets(home) as [PlanetId, PlanetId];
    render(<Table map actions={{ Münze: COIN }} />);
    expect(document.querySelector('svg .site-target')).toBeNull();
    fireEvent.click(figureOf('infantry'));
    const rings = [...document.querySelectorAll<SVGElement>('svg .site-target')];
    expect(rings.map((ring) => ring.dataset['planet']).sort()).toEqual([first, second].sort());
    expect(rings.every((ring) => ring.dataset['siteKind'] === 'deploy')).toBe(true);
    expect(
      document.querySelector(`svg [data-system="${home}"]`)?.getAttribute('data-target-state'),
    ).toBe('legal');
    fireEvent.click(document.querySelector(`svg .site-target[data-planet="${second}"]`) as Element);
    expect(pieceOf('infantry').dataset['ordered']).toBe('1');
    expect(document.querySelector('svg .site-target')).toBeNull();
    const ground = yard().querySelector('.shipyard-ground') as HTMLElement;
    expect(ground.textContent).toContain(`Bodentruppen auf: ${planetLabel(second, 'de')}`);
    const pick = within(ground).getByRole('button', { name: planetLabel(first, 'de') });
    fireEvent.click(pick);
    expect(pick.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(within(ground).getByRole('button', { name: planetLabel(second, 'de') }));
    fireEvent.click(screen.getByRole('button', { name: 'Münze' }));
    const before = infantryOn(second);
    fireEvent.click(button('Produzieren'));
    expect(store().error).toBeNull();
    expect(infantryOn(second)).toBe(before + 1);
  });

  it('Werft: jeder Stein nennt seinen Namen, die günstigen Einheiten liegen vorn', () => {
    producing();
    render(<Table />);
    expect(pieceOf('infantry').querySelector('.shipyard-name')?.textContent).toBe('Infanterie');
    const order = [...yard().querySelectorAll<HTMLElement>('.shipyard-piece')].map(
      (piece) => piece.dataset['unit'],
    );
    expect(order.slice(0, 2).sort()).toEqual(['fighter', 'infantry']);
  });

  it('Werft: das Dock ist nur ein Tabstopp, solange das getragene Stück hinein darf', () => {
    producing();
    render(<Table />);
    expect(dock().tabIndex).toBe(-1);
    // Eine Münze für die Kasse in der Hand: Das Dock nimmt sie nicht und bleibt außer Reichweite.
    act(() => {
      useCarryStore.setState({
        piece: GOODS_PIECE,
        legal: new Set([targetKey(KASSE)]),
        mode: 'keyboard',
      });
    });
    expect(dock().getAttribute('aria-disabled')).toBe('true');
    expect(dock().tabIndex).toBe(-1);
    act(() => {
      useCarryStore.setState({ piece: null, legal: new Set<string>(), mode: null });
    });
    fireEvent.click(figureOf('infantry'), { detail: 0 });
    expect(dock().tabIndex).toBe(0);
  });

  it('Werft: ein Schiff auf das leuchtende System gelegt wird bestellt', () => {
    const { home } = producing();
    render(<Table map />);
    fireEvent.click(figureOf('cruiser'));
    expect(document.querySelector('svg .site-target')).toBeNull();
    const system = document.querySelector(`svg [data-system="${home}"]`) as Element;
    expect(system.getAttribute('data-target-state')).toBe('legal');
    fireEvent.click(system);
    expect(pieceOf('cruiser').dataset['ordered']).toBe('1');
  });

  it('Kriegsführung sekundär: die Werft steht in der Ansage, das Siegel heißt Ohne Bau abschließen', () => {
    const state = pickAll(started());
    const turn = state.actionPhase as NonNullable<GameState['actionPhase']>;
    const me = state.players.find((player) => player.id !== turn.active)?.id as PlayerId;
    const secondary = { card: cardOf('warfare').id, awaiting: [me], free: [] };
    seatTable({ ...state, actionPhase: { ...turn, secondary } }, { me });
    render(<Table />);
    expect(yard()).toBeTruthy();
    expect(button('Ohne Bau abschließen').dataset['testid']).toBe('confirm');
    expect(within(prompt()).getAllByRole('button', { name: 'Ablehnen' })).toHaveLength(1);
    fireEvent.click(button('Infanterie +'));
    expect(button('Produzieren').dataset['testid']).toBe('confirm');
    expect(within(prompt()).queryByRole('button', { name: 'Ohne Bau abschließen' })).toBeNull();
  });
});

describe('Werft in der klassischen Ansicht', () => {
  beforeEach(() => {
    useSettingsStore.setState({ tableView: false });
  });

  it('klassische Ansicht: das Produktionsformular bleibt', () => {
    producing();
    render(<Table />);
    const card = document.querySelector('.notice.decision') as HTMLElement;
    expect(card.querySelector('.production-form')).not.toBeNull();
    expect(within(card).getByRole('heading', { name: 'Produktion' })).toBeTruthy();
    expect(within(card).getByRole('button', { name: 'Infanterie +' })).toBeTruthy();
    expect(screen.queryByTestId('shipyard')).toBeNull();
    expect(screen.queryByTestId('confirm')).toBeNull();
  });
});
