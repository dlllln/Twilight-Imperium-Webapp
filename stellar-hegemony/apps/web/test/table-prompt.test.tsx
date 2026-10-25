// @vitest-environment jsdom
import {
  type CommandTokensChoice,
  findPlayer,
  type GameState,
  objectiveId,
  type PlanetId,
  type PlayerId,
  systemId,
  updatePlayer,
} from '@stellar/domain';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { NoticeStack } from '../src/components/hud/NoticeStack.tsx';
import { ObjectiveStrip } from '../src/components/table/ObjectiveStrip.tsx';
import { useGameStore } from '../src/game-store.ts';
import { useHandStore } from '../src/hand/hand-store.ts';
import { tryCommand } from '../src/rules-preview.ts';
import { useSettingsStore } from '../src/settings-store.ts';
import { useGalaxyStore } from '../src/store.ts';
import type { TableAction } from '../src/table/table-specs.ts';
import { useDraftStore } from '../src/table/draft-store.ts';
import { useTableDecision } from '../src/table/use-table-decision.ts';
import { cardOf, holding } from './card-form-helpers.tsx';
import { pickAll, started } from './game-helpers.ts';
import { leaveTable, seatTable } from './local-table.ts';

const store = () => useGameStore.getState();
const game = () => store().game as GameState;
const prompt = () => screen.getByRole('region', { name: 'Entscheidung' });

beforeEach(() => {
  leaveTable();
  useGalaxyStore.setState({ language: 'de' });
  useSettingsStore.setState({ animations: false, tableView: true });
  useHandStore.getState().clear();
  useDraftStore.getState().clear();
});

afterEach(cleanup);

/** Legt wie das Pult einen losen Marker auf die Taktikleiste (die Leisten selbst fehlen hier). */
function Mover({ state }: { readonly state: GameState }): ReactElement {
  const decision = useTableDecision(state);
  const move = () => decision?.act({ kind: 'move', from: 'loose', to: 'tactic' });
  return (
    <button type="button" onClick={move}>
      Marker legen
    </button>
  );
}

/** Eine Handlung am Entwurf, wie sie Pult oder Karte auslösen (Planet antippen, Münze legen). */
function Acting(props: {
  readonly state: GameState;
  readonly label: string;
  readonly action: TableAction;
}) {
  const decision = useTableDecision(props.state);
  return (
    <button type="button" onClick={() => decision?.act(props.action)}>
      {props.label}
    </button>
  );
}

function Live(props: {
  readonly actions?: Readonly<Record<string, TableAction>>;
}): ReactElement | null {
  const current = useGameStore((state) => state.game);
  if (current === null) return null;
  return (
    <>
      <NoticeStack game={current} />
      <ObjectiveStrip game={current} />
      <Mover state={current} />
      {Object.entries(props.actions ?? {}).map(([label, action]) => (
        <Acting key={label} state={current} label={label} action={action} />
      ))}
    </>
  );
}

/** Statusphase, Wertung: öffentliche Aufträge liegen offen, der Erste der Reihe sitzt am Bildschirm. */
function scoringTable(): PlayerId {
  const state = pickAll(started());
  const order = state.players.map((player) => player.id);
  const me = order[0] as PlayerId;
  const statusPhase = { step: 'scoring', order, waiting: order, scored: {} } as const;
  const slots = ['merchant-reserve', 'war-chest', 'settled-reach'].map((id) => ({
    id: objectiveId(id),
    stage: 1,
    revealed: true,
  }));
  const objectives = { ...state.objectives, public: slots };
  const status = { ...state, phase: 'status', actionPhase: null, statusPhase, objectives } as const;
  seatTable(
    updatePlayer(status, me, (p) => ({ ...p, tradeGoods: 10 })),
    { me },
  );
  return me;
}

/** Passt den Tisch vor dem Platznehmen an (z. B. erschöpfte Planeten). */
type Change = (state: GameState, me: PlayerId) => GameState;

const unchanged: Change = (state) => state;

/** Die Sekundärfähigkeit der Karte steht für einen Mitspieler offen; er sitzt am Bildschirm. */
function following(mechanic: 'imperial' | 'diplomacy' | 'politics', change = unchanged): PlayerId {
  const state = pickAll(started());
  const turn = state.actionPhase as NonNullable<GameState['actionPhase']>;
  const me = state.players.find((player) => player.id !== turn.active)?.id as PlayerId;
  const secondary = { card: cardOf(mechanic).id, awaiting: [me], free: [] };
  seatTable(change({ ...state, actionPhase: { ...turn, secondary } }, me), { me });
  return me;
}

/** Alle eigenen Planeten des Spielers sind erschöpft. */
function exhausted(state: GameState, player: PlayerId): GameState {
  const planets = Object.fromEntries(
    Object.entries(state.planets).map(([id, planet]) => [
      id,
      planet.controller === player ? { ...planet, exhausted: true } : planet,
    ]),
  );
  return { ...state, planets };
}

/** Der aktive Spieler hat die Karte aus der Hand gewählt und sitzt am Bildschirm. */
function choosing(mechanic: 'commandTokens' | 'diplomacy' | 'technology'): PlayerId {
  const { player, card } = holding(mechanic);
  seatTable(game(), { me: player });
  useHandStore.getState().choose({ player, card: card.id });
  return player;
}

/** Erstes System, das der Aktive aktivieren darf: danach läuft seine taktische Aktion. */
function activated(state: GameState, active: PlayerId): GameState {
  for (const id of Object.keys(state.systems)) {
    const command = { type: 'ActivateSystem', issuedBy: active, system: systemId(id) } as const;
    const next = tryCommand(state, command);
    if (next.ok) return next.value;
  }
  throw new Error('kein System aktivierbar');
}

/** Der Aktive hat ein System aktiviert; ein anderer muss im Kampf Treffer zuteilen. */
function defending(): PlayerId {
  const state = pickAll(started());
  const active = state.actionPhase?.active as PlayerId;
  const defender = state.players.find((player) => player.id !== active)?.id as PlayerId;
  const fighting = activated(state, active);
  const turn = fighting.actionPhase as NonNullable<GameState['actionPhase']>;
  const tactical = { ...turn.tactical, pendingHits: [{ player: defender, hits: 1 }] };
  seatTable({ ...fighting, actionPhase: { ...turn, tactical } } as GameState, { me: defender });
  return defender;
}

describe('Ansage am Pult (Tischansicht)', () => {
  it('Tischansicht: die Entscheidung erscheint als Ansage am Pult, nicht als Benachrichtigung', () => {
    const state = pickAll(started());
    seatTable(state, { me: state.actionPhase?.active as PlayerId });
    render(<Live />);
    expect(prompt().dataset['kind']).toBe('idle');
    expect(document.querySelector('.notice.decision')).toBeNull();
    expect(prompt().closest('[aria-live]')).toBeNull();
    expect(within(prompt()).queryAllByRole('status')).toHaveLength(0);
  });

  it('klassische Ansicht behält die Entscheidungskarte', () => {
    useSettingsStore.setState({ tableView: false });
    const state = pickAll(started());
    seatTable(state, { me: state.actionPhase?.active as PlayerId });
    render(<Live />);
    expect(document.querySelector('.notice.decision .hand-hint')).not.toBeNull();
    expect(screen.queryByTestId('decision')).toBeNull();
  });

  it('geheime Aufträge liegen auch in der Tischansicht auf dem Kartentisch, nicht in der Ansage', () => {
    seatTable(started(), { me: started().players[0]?.id as PlayerId });
    render(<Live />);
    const table = screen.getByRole('dialog', { name: 'Geheime Aufträge wählen' });
    expect(table.classList.contains('secret-choice')).toBe(true);
    expect(screen.queryByTestId('decision')).toBeNull();
    expect(document.querySelector('.notice.decision')).toBeNull();
  });

  it('Führung: die Ansage zeigt die erhaltenen Marker und Ausführen erst bei leerer Schale', () => {
    const player = choosing('commandTokens');
    const tactic = findPlayer(game(), player)?.commandPools.tactic ?? 0;
    render(<Live />);
    const seal = () =>
      within(prompt()).getByRole<HTMLButtonElement>('button', { name: 'Ausführen' });
    expect(within(prompt()).getByRole('heading', { name: 'Führung' })).toBeTruthy();
    expect(screen.getByTestId('tokens-gained').textContent).toBe('3');
    expect(screen.getByTestId('free-tokens').textContent).toBe('3');
    expect(screen.queryByRole('button', { name: 'Taktik +' })).toBeNull();
    expect(seal().disabled).toBe(true);
    for (let token = 0; token < 3; token += 1)
      fireEvent.click(screen.getByRole('button', { name: 'Marker legen' }));
    expect(screen.getByTestId('free-tokens').textContent).toBe('0');
    fireEvent.click(seal());
    expect(store().error).toBeNull();
    expect(findPlayer(game(), player)?.commandPools.tactic).toBe(tactic + 3);
    expect(useHandStore.getState().chosen).toBeNull();
  });

  it('Sekundärfähigkeit Führung: Ablehnen sendet DeclineSecondary', () => {
    const player = choosing('commandTokens');
    const card = cardOf('commandTokens').id;
    const allocation = { tactic: 3, fleet: 0, strategy: 0 };
    const choice: CommandTokensChoice = {
      mechanic: 'commandTokens',
      influence: { planets: [], tradeGoods: 0 },
      allocation,
    };
    store().send({ type: 'PerformStrategicAction', issuedBy: player, card, choice });
    useHandStore.getState().clear();
    const next = game().actionPhase?.secondary?.awaiting[0] as PlayerId;
    useGameStore.setState({ me: next });
    render(<Live />);
    expect(
      within(prompt()).getByRole('heading', { name: 'Sekundärfähigkeit: Führung' }),
    ).toBeTruthy();
    fireEvent.click(within(prompt()).getByRole('button', { name: 'Ablehnen' }));
    expect(store().error).toBeNull();
    expect(game().actionPhase?.secondary?.awaiting ?? []).not.toContain(next);
  });

  it('nicht umgestellte Entscheidungen zeigen ihr Formular in der Ansage', () => {
    following('politics');
    render(<Live />);
    const body = prompt().querySelector('.table-prompt-body') as HTMLElement;
    expect(body.querySelector('.choice-form')?.textContent).toContain('Du ziehst 2 Aktionskarten.');
    expect(within(body).getAllByRole('button', { name: 'Ausführen' })).toHaveLength(1);
    expect(screen.queryByTestId('confirm')).toBeNull();
  });

  it('der Verteidiger sieht nur den Hinweis auf den Kampf und kein Tauschformular', () => {
    defending();
    render(<Live />);
    const region = prompt();
    expect(region.dataset['kind']).toBe('combat');
    expect(within(region).getAllByText('Im Kampf wartet eine Entscheidung auf dich.')).toHaveLength(
      1,
    );
    expect(within(region).getByRole('button', { name: 'Kampfansicht öffnen' })).toBeTruthy();
    expect(region.querySelector('.transaction')).toBeNull();
    expect(within(region).queryByRole('button', { name: 'Taktische Aktion beenden' })).toBeNull();
  });

  it('wartet man auf andere, nennt die Ansage nur, wer am Zug ist', () => {
    const state = pickAll(started());
    const active = state.actionPhase?.active as PlayerId;
    const other = state.players.find((player) => player.id !== active)?.id as PlayerId;
    seatTable(state, { me: other });
    render(<Live />);
    const region = prompt();
    expect(region.textContent).toContain(findPlayer(state, active)?.name ?? '?');
    expect(region.textContent).toContain('ist am Zug');
    expect(within(region).queryAllByRole('button')).toHaveLength(0);
    expect(within(region).queryAllByRole('heading')).toHaveLength(0);
  });

  it('eine stehende Live-Zeile sagt das Warten auf andere und die eigene Entscheidung an', () => {
    const state = pickAll(started());
    const active = state.actionPhase?.active as PlayerId;
    const other = state.players.find((player) => player.id !== active)?.id as PlayerId;
    seatTable(state, { me: other });
    render(<Live />);
    const line = screen.getByTestId('decision-announcer');
    expect(line.getAttribute('aria-live')).toBe('polite');
    expect(line.closest('.table-prompt')).toBeNull();
    const name = findPlayer(state, active)?.name ?? '';
    expect(line.textContent).toBe(`${name} ist am Zug …`);
    act(() => useGameStore.setState({ me: active }));
    expect(screen.getByTestId('decision-announcer')).toBe(line);
    expect(line.textContent).toBe(
      'Aktion – Ziehe einen Taktikmarker auf ein System, um es zu aktivieren.',
    );
  });

  it('Kriegsführung: die Messleiste bleibt leer, bis ein Marker von der Karte genommen ist', () => {
    const { player, card, home } = holding('warfare', true);
    seatTable(game(), { me: player });
    useHandStore.getState().choose({ player, card: card.id });
    render(<Live />);
    const meter = () => prompt().querySelector('.table-prompt-meter');
    expect(meter()?.getAttribute('aria-live')).toBe('polite');
    expect(meter()?.textContent).toBe('');
    fireEvent.change(within(prompt()).getByRole('combobox'), { target: { value: home } });
    expect(meter()?.textContent).toBe('Von der Karte genommen: 1 · noch zu verteilen: 1');
  });

  it('Führung: die Ansage zeigt keine Münzknöpfe mehr', () => {
    choosing('commandTokens');
    render(<Live />);
    expect(
      within(prompt()).queryByRole('button', { name: /Handelswaren als Einfluss/ }),
    ).toBeNull();
    expect(prompt().querySelector('.table-prompt-coins')).toBeNull();
    expect(within(prompt()).getByTestId('paid').textContent).toBe('0');
    expect(prompt().querySelector('.table-prompt-meter')?.textContent).toContain('Einfluss: 0');
  });

  it('Wertung: ohne Wahl heißt das Siegel Wertung beenden und sendet EndScoring', () => {
    const me = scoringTable();
    render(<Live />);
    expect(within(prompt()).getByRole('heading', { name: 'Aufträge werten' })).toBeTruthy();
    expect(within(prompt()).queryByRole('button', { name: 'Zurück' })).toBeNull();
    const seal = within(prompt()).getByRole<HTMLButtonElement>('button', {
      name: 'Wertung beenden',
    });
    expect(seal.disabled).toBe(false);
    fireEvent.click(seal);
    expect(store().error).toBeNull();
    expect(game().statusPhase?.waiting).not.toContain(me);
    expect(findPlayer(game(), me)?.victoryPoints).toBe(0);
  });

  it('ein Ausgabe-Auftrag zeigt bezahlt / benötigt in der Ansage', () => {
    const me = scoringTable();
    render(<Live actions={{ Münze: { kind: 'tradeGoods', delta: 1 } }} />);
    const strip = screen.getByRole('region', { name: 'Aufträge auf dem Tisch' });
    fireEvent.click(within(strip).getByRole('button', { name: 'Kriegskasse' }));
    const meter = () => prompt().querySelector('.table-prompt-meter')?.textContent;
    expect(meter()).toContain('Gewählt: Kriegskasse');
    expect(meter()).toContain('Ressourcen: 0 / 8');
    expect(within(prompt()).getByText(/Tippe Planetenkarten/)).toBeTruthy();
    const seal = () => within(prompt()).getByRole<HTMLButtonElement>('button', { name: 'Werten' });
    expect(seal().disabled).toBe(true);
    for (let coin = 0; coin < 8; coin += 1)
      fireEvent.click(screen.getByRole('button', { name: 'Münze' }));
    expect(within(prompt()).getByTestId('paid').textContent).toBe('8');
    fireEvent.click(seal());
    expect(store().error).toBeNull();
    expect(findPlayer(game(), me)).toMatchObject({ victoryPoints: 1, tradeGoods: 2 });
  });

  it('Imperium sekundär: Siegel Geheimen Auftrag ziehen, Ablehnen sendet DeclineSecondary', () => {
    const me = following('imperial');
    render(<Live />);
    expect(
      within(prompt()).getByRole('heading', { name: 'Sekundärfähigkeit: Imperium' }),
    ).toBeTruthy();
    expect(within(prompt()).getByRole('button', { name: 'Geheimen Auftrag ziehen' })).toBeTruthy();
    fireEvent.click(within(prompt()).getByRole('button', { name: 'Ablehnen' }));
    expect(store().error).toBeNull();
    expect(game().actionPhase?.secondary?.awaiting ?? []).not.toContain(me);
  });

  it('Diplomatie sekundär: die Ansage zählt die bereitzumachenden Planeten', () => {
    const me = following('diplomacy', exhausted);
    const tired = Object.values(game().planets).filter((p) => p.controller === me && p.exhausted);
    const planet = tired[0]?.id as PlanetId;
    render(<Live actions={{ Antippen: { kind: 'planet', planet } }} />);
    const meter = () => prompt().querySelector('.table-prompt-meter')?.textContent;
    expect(meter()).toBe('Bereitzumachen: 0 / 2');
    fireEvent.click(screen.getByRole('button', { name: 'Antippen' }));
    expect(meter()).toBe('Bereitzumachen: 1 / 2');
    fireEvent.click(within(prompt()).getByRole('button', { name: 'Planeten bereitmachen' }));
    expect(store().error).toBeNull();
    expect(game().planets[planet]?.exhausted).toBe(false);
    expect(game().actionPhase?.secondary?.awaiting ?? []).not.toContain(me);
  });
});
