// @vitest-environment jsdom
import {
  adjacentSystemIds,
  constructionSites,
  diplomacySystems,
  type GameState,
  hasCapability,
  type PlanetId,
  type PlayerId,
  type SystemId,
  type TacticalStep,
  type Unit,
  unitId,
  unitTypeId,
  updatePlayer,
} from '@stellar/domain';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { homeSystemOf } from '../src/card-view.ts';
import { NoticeStack } from '../src/components/hud/NoticeStack.tsx';
import { CarryAnnouncer } from '../src/components/table/CarryAnnouncer.tsx';
import { DragGhost } from '../src/components/table/DragGhost.tsx';
import { useGameStore } from '../src/game-store.ts';
import { useHandStore } from '../src/hand/hand-store.ts';
import { translate } from '../src/i18n.ts';
import { systemLabel, unitLabel } from '../src/labels.ts';
import { useSettingsStore } from '../src/settings-store.ts';
import { content, useGalaxyStore } from '../src/store.ts';
import { useCarryStore } from '../src/table/carry-store.ts';
import { useDraftStore } from '../src/table/draft-store.ts';
import type { TableAction } from '../src/table/table-specs.ts';
import { siteTarget, targetKey, unitTarget } from '../src/table/target-ref.ts';
import { useDropRouter } from '../src/table/use-drop-router.ts';
import { useTableDecision } from '../src/table/use-table-decision.ts';
import { useTarget } from '../src/table/use-target.ts';
import { holding } from './card-form-helpers.tsx';
import { installDomPolyfills } from './dom-polyfills.ts';
import { pickAll, started } from './game-helpers.ts';
import { leaveTable, seatTable } from './local-table.ts';

installDomPolyfills();

const store = () => useGameStore.getState();
const game = () => store().game as GameState;
const prompt = () => screen.getByRole('region', { name: 'Entscheidung' });
const button = (name: string) => within(prompt()).getByRole<HTMLButtonElement>('button', { name });
const meter = () => prompt().querySelector('.table-prompt-meter')?.textContent ?? '';

const EMPTY_HAND = { piece: null, legal: new Set<string>(), over: null, point: null, mode: null };

beforeEach(() => {
  leaveTable();
  useGalaxyStore.setState({ language: 'de' });
  useSettingsStore.setState({ animations: false, tableView: true });
  useHandStore.getState().clear();
  useDraftStore.getState().clear();
  useCarryStore.setState({ ...EMPTY_HAND, news: null });
});

afterEach(cleanup);

/** Eine Handlung am Entwurf, wie sie Karte oder Pult auslösen (Planet antippen, Münze legen). */
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

/** Ein Bauplatz wie auf der Karte: ein Ziel `site:<planet>` mit dem Zustand der Entscheidung. */
function Site({ state, planet }: { readonly state: GameState; readonly planet: PlanetId }) {
  const decision = useTableDecision(state);
  const router = useDropRouter(state);
  const ref = siteTarget(planet);
  const target = useTarget(ref, decision?.targets.get(targetKey(ref)), router);
  return (
    <button type="button" {...target.props}>
      Bauplatz
    </button>
  );
}

function Live(props: {
  readonly actions?: Readonly<Record<string, TableAction>>;
  readonly site?: PlanetId;
}): ReactElement | null {
  const current = useGameStore((state) => state.game);
  if (current === null) return null;
  return (
    <>
      <NoticeStack game={current} />
      <CarryAnnouncer game={current} />
      {props.site !== undefined && <Site state={current} planet={props.site} />}
      {Object.entries(props.actions ?? {}).map(([label, action]) => (
        <Acting key={label} state={current} label={label} action={action} />
      ))}
    </>
  );
}

const figure = (id: string, type: string, owner: PlayerId): Unit => ({
  id: unitId(id),
  type: unitTypeId(type),
  owner,
  damaged: false,
});

const activeOf = (state: GameState): PlayerId => state.actionPhase?.active as PlayerId;

/** Ein Nachbarsystem der Heimat mit freiem Planeten und ohne Anomalie. */
function freeWorldNear(state: GameState, player: PlayerId): SystemId {
  const home = state.systems[homeSystemOf(state, player, content) ?? ''];
  if (home === undefined) throw new Error('keine Heimat');
  const found = adjacentSystemIds(state.systems, home).find((id) => {
    const system = state.systems[id];
    return (
      system?.anomaly === undefined &&
      system?.planetIds.some((planet) => state.planets[planet]?.controller === null) === true
    );
  });
  if (found === undefined) throw new Error('kein freier Planet');
  return found;
}

const centerSystem = (state: GameState): SystemId => {
  const found = Object.values(state.systems).find(
    (system) => content.tiles.find(system.id)?.back === 'center',
  );
  if (found === undefined) throw new Error('kein Zentrum');
  return found.id;
};

interface Scene {
  readonly system: SystemId;
  readonly planet: PlanetId;
}

/** Der Aktive steht mit `units` im Weltraum von `system` und sitzt am Bildschirm; Schritt `step`. */
function seatedAt(
  state: GameState,
  system: SystemId,
  step: TacticalStep,
  units: (player: PlayerId) => readonly Unit[],
): Scene {
  const actor = activeOf(state);
  const tile = state.systems[system] as GameState['systems'][string];
  const tactical = { system, step, pendingHits: [], combat: null, windows: [], bonuses: [] };
  const next: GameState = {
    ...state,
    systems: { ...state.systems, [system]: { ...tile, spaceUnits: units(actor) } },
    actionPhase: state.actionPhase && { ...state.actionPhase, tactical },
  };
  seatTable(next, { me: actor });
  return { system, planet: tile.planetIds[0] as PlanetId };
}

/** Ein Schlachtschiff über einem fremden Planeten mit gegnerischer Infanterie. */
function bombarding(): Scene {
  const state = pickAll(started());
  const actor = activeOf(state);
  const enemy = state.players.find((p) => p.id !== actor)?.id as PlayerId;
  const system = freeWorldNear(state, actor);
  const planet = state.systems[system]?.planetIds[0] as PlanetId;
  const world = state.planets[planet] as GameState['planets'][string];
  const defender = figure('feind', 'infantry', enemy);
  const held = { ...state.planets, [planet]: { ...world, controller: enemy, units: [defender] } };
  return seatedAt({ ...state, planets: held }, system, 'bombardment', (owner) => [
    figure('bs', 'dreadnought', owner),
  ]);
}

/** Landung im Zentrum: Die Thronwelt kostet Einfluss, Handelswaren sind da. */
function throneLanding(): Scene {
  const base = pickAll(started());
  const state = updatePlayer(base, activeOf(base), (p) => ({ ...p, tradeGoods: 6 }));
  return seatedAt(state, centerSystem(state), 'invasion', (owner) => [
    figure('traeger', 'carrier', owner),
    figure('inf-1', 'infantry', owner),
    figure('inf-2', 'infantry', owner),
  ]);
}

/** Alle Schritte sind erledigt; es bleibt das Beenden. */
function allDone(): Scene {
  const state = pickAll(started());
  return seatedAt(state, freeWorldNear(state, activeOf(state)), 'done', () => []);
}

/** Der Spieler bekommt `count` freie Planeten ohne Einheiten dazu. */
function owning(state: GameState, player: PlayerId, count: number): GameState {
  const taken = Object.values(state.planets)
    .filter((planet) => planet.controller === null && planet.units.length === 0)
    .slice(0, count)
    .map((planet) => ({ ...planet, controller: player }));
  return {
    ...state,
    planets: { ...state.planets, ...Object.fromEntries(taken.map((p) => [p.id, p])) },
  };
}

/** Der Aktive hat die Karte aus der Hand gewählt und sitzt am Bildschirm. */
function choosing(mechanic: 'diplomacy' | 'construction', extraPlanets = 0): PlayerId {
  const { player, card } = holding(mechanic);
  seatTable(owning(game(), player, extraPlanets), { me: player });
  useHandStore.getState().choose({ player, card: card.id });
  return player;
}

describe('Ansage am Pult: taktische Aktion und Bauen (Tischansicht)', () => {
  it('taktische Schritte nennen das aktivierte System als Überschrift', () => {
    const { system } = bombarding();
    render(<Live />);
    const name = `Aktiviertes System: ${systemLabel(game(), system, 'de')}`;
    expect(within(prompt()).getByRole('heading', { name })).toBeTruthy();
    expect(screen.getAllByRole('heading', { name: /Aktiviertes System/ })).toHaveLength(1);
    expect(prompt().querySelector('.table-prompt-body')).toBeNull();
  });

  it('Bombardement: ohne Zuweisung heißt das Siegel Ohne Bombardement weiter, danach gibt es Bombardieren und den Ausweg', () => {
    const { planet } = bombarding();
    render(<Live actions={{ Antippen: { kind: 'site', planet } }} />);
    expect(button('Ohne Bombardement weiter').dataset['testid']).toBe('confirm');
    expect(button('Ohne Bombardement weiter').disabled).toBe(false);
    expect(meter()).toBe('Zugewiesen: 0 / 1');
    fireEvent.click(screen.getByRole('button', { name: 'Antippen' }));
    expect(screen.getByTestId('assigned-count').textContent).toBe('1');
    expect(button('Bombardieren').dataset['testid']).toBe('confirm');
    expect(button('Ohne Bombardement weiter').classList.contains('table-prompt-alt')).toBe(true);
    fireEvent.click(button('Bombardieren'));
    expect(store().error).toBeNull();
    expect(game().actionPhase?.tactical?.step).not.toBe('bombardment');
  });

  it('Landung auf der Thronwelt: bezahlt / benötigt steht in der Ansage, Landen bleibt bis dahin gesperrt', () => {
    const { planet } = throneLanding();
    const coin: TableAction = { kind: 'tradeGoods', delta: 1 };
    render(<Live actions={{ Antippen: { kind: 'site', planet }, Münze: coin }} />);
    expect(screen.queryByTestId('paid')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Antippen' }));
    expect(meter()).toBe('Zugewiesen: 1 / 2Einfluss: 0 / 6');
    expect(within(prompt()).getByText(/Tippe Planetenkarten/)).toBeTruthy();
    expect(button('Landen').disabled).toBe(true);
    for (let count = 0; count < 6; count += 1)
      fireEvent.click(screen.getByRole('button', { name: 'Münze' }));
    expect(screen.getByTestId('paid').textContent).toBe('6');
    expect(button('Landen').disabled).toBe(false);
    fireEvent.click(button('Landen'));
    expect(store().error).toBeNull();
    expect(game().planets[planet]?.controller).toBe(activeOf(game()));
  });

  it('nach allen Schritten steht der Abschlusssatz genau einmal da und das Siegel sendet EndTacticalAction', () => {
    allDone();
    const actor = activeOf(game());
    render(<Live />);
    const sentence = 'Alle Schritte dieser taktischen Aktion sind erledigt.';
    // Auch mit der Live-Zeile für Bildschirmleser steht der Satz nur einmal auf der Seite.
    expect(screen.getAllByText(new RegExp(sentence))).toHaveLength(1);
    expect(screen.getByTestId('decision-announcer').textContent).toContain(
      'Beende die taktische Aktion mit dem Siegel.',
    );
    const hints = [...prompt().querySelectorAll('p.hint')].map((line) => line.textContent);
    expect(hints.filter((line) => line !== translate('de', 'tableHintExplore'))).toEqual([
      sentence,
    ]);
    expect(screen.getAllByRole('button', { name: 'Taktische Aktion beenden' })).toHaveLength(1);
    fireEvent.click(button('Taktische Aktion beenden'));
    expect(store().error).toBeNull();
    expect(game().actionPhase?.tactical ?? null).toBeNull();
    expect(game().actionPhase?.active).not.toBe(actor);
  });

  it('Diplomatie primär: System wählen wählt ein leuchtendes System, Ausführen sendet es', () => {
    const me = choosing('diplomacy', 2);
    const systems = diplomacySystems(game(), me, content.tiles);
    const other = systems[1] as SystemId;
    render(<Live />);
    const select = within(prompt()).getByLabelText<HTMLSelectElement>('System wählen');
    expect([...select.options].map((option) => option.value)).toEqual(systems);
    fireEvent.change(select, { target: { value: other } });
    expect(useDraftStore.getState().draft).toEqual({ kind: 'system', system: other });
    fireEvent.click(button('Ausführen'));
    expect(store().error).toBeNull();
    const others = game().players.filter((player) => player.id !== me);
    for (const player of others) expect(game().systems[other]?.commandTokens).toContain(player.id);
  });

  it('Infrastruktur: ein Gebäude per Tastatur aufnehmen und auf einem Planetenziel ablegen', () => {
    const me = choosing('construction');
    const [site] = constructionSites(game(), me, content.units, 'primary');
    if (site === undefined) throw new Error('kein Bauplatz');
    const type = site.types[0] as string;
    render(<Live site={site.planet} />);
    const tray = within(prompt()).getByRole('region', { name: 'Bauvorrat' });
    const piece = within(tray).getByRole('button', {
      name: `Gebäude aufnehmen: ${unitLabel(type, 'de')}`,
    });
    expect(piece.querySelector('img')?.getAttribute('src')).toMatch(/^\/ti4\/units\//);
    expect(button('Bauen').disabled).toBe(true);
    act(() => {
      fireEvent.click(piece, { detail: 0 });
    });
    const stub = screen.getByRole('button', { name: 'Bauplatz' });
    expect(stub.dataset['targetState']).toBe('legal');
    expect(document.activeElement).toBe(stub);
    fireEvent.keyDown(stub, { key: 'Enter' });
    expect(screen.getByTestId('placed-count').textContent).toBe('1');
    expect(stub.dataset['targetState']).toBe('chosen');
    fireEvent.click(button('Bauen'));
    expect(store().error).toBeNull();
    expect(game().planets[site.planet]?.units.map((unit) => unit.type)).toContain(type);
  });

  it('ein gesetztes Gebäude lässt sich in der Ansage zurücknehmen', () => {
    const me = choosing('construction');
    const [site] = constructionSites(game(), me, content.units, 'primary');
    if (site === undefined) throw new Error('kein Bauplatz');
    render(<Live actions={{ Antippen: { kind: 'site', planet: site.planet } }} />);
    expect(prompt().querySelector('.placement-chip')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Antippen' }));
    const chip = within(prompt()).getByRole('button', { name: /zurücknehmen$/ });
    expect(chip.classList.contains('placement-chip')).toBe(true);
    expect(chip.getAttribute('aria-label')).toContain(' auf ');
    expect(screen.getByTestId('placed-count').textContent).toBe('1');
    chip.focus();
    fireEvent.click(chip);
    expect(prompt().querySelector('.placement-chip')).toBeNull();
    expect(screen.getByTestId('placed-count').textContent).toBe('0');
    const type = site.types[0] as string;
    const piece = within(prompt()).getByRole('button', {
      name: `Gebäude aufnehmen: ${unitLabel(type, 'de')}`,
    });
    expect(document.activeElement).toBe(piece);
  });

  it('nach dem Zurücknehmen einer von zwei Plaketten rückt der Fokus auf die verbliebene', () => {
    const me = choosing('construction');
    const [site] = constructionSites(game(), me, content.units, 'primary');
    const cannon = site?.types.find((type) => {
      const unit = content.units.find(type);
      return unit !== undefined && hasCapability(unit, 'spaceCannon');
    });
    if (site === undefined || cannon === undefined) throw new Error('keine Weltraumkanone');
    const place: TableAction = { kind: 'place', type: cannon, planet: site.planet };
    render(<Live actions={{ Setzen: place }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Setzen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Setzen' }));
    const chips = () => within(prompt()).getAllByRole('button', { name: /zurücknehmen$/ });
    expect(chips()).toHaveLength(2);
    const [first] = chips();
    first?.focus();
    fireEvent.click(first as HTMLElement);
    expect(chips()).toHaveLength(1);
    expect(document.activeElement).toBe(chips()[0]);
  });

  it('eine getragene Figur zeigt im Geist ihr Bild', () => {
    bombarding();
    render(<DragGhost faction="test" seat="#E69F00" />);
    expect(document.querySelector('.drag-ghost')).toBeNull();
    act(() => {
      useCarryStore.getState().pickUp(unitTarget('bs'), new Set(), 'drag');
      useCarryStore.getState().track({ x: 40, y: 50 }, null);
    });
    const ghost = document.querySelector('.drag-ghost');
    expect(ghost?.getAttribute('data-material')).toBe('unit');
    expect(ghost?.querySelector('img')?.getAttribute('src')).toMatch(/_dn\.png$/);
    expect(ghost?.querySelector('.sheet-token')).toBeNull();
  });
});

describe('Ansage am Pult: klassische Ansicht', () => {
  beforeEach(() => {
    useSettingsStore.setState({ tableView: false });
  });

  it('klassische Ansicht: Infrastruktur und Bombardement behalten ihre Formulare', () => {
    choosing('construction');
    const { unmount } = render(<Live />);
    const card = document.querySelector('.notice.decision') as HTMLElement;
    expect(within(card).getByRole('button', { name: 'Bauen' })).toBeTruthy();
    expect(card.querySelector('select')).not.toBeNull();
    expect(document.querySelector('.structure-tray')).toBeNull();
    expect(screen.queryByTestId('confirm')).toBeNull();
    unmount();
    useHandStore.getState().clear();
    bombarding();
    render(<Live />);
    const form = document.querySelector('.notice.decision') as HTMLElement;
    expect(within(form).getByRole('heading', { name: 'Bombardement' })).toBeTruthy();
    expect(within(form).getByRole('button', { name: 'Ohne Bombardement weiter' })).toBeTruthy();
    expect(screen.queryByTestId('assigned-count')).toBeNull();
    expect(screen.queryByTestId('confirm')).toBeNull();
  });
});
