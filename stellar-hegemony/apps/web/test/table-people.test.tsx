// @vitest-environment jsdom
import {
  actionCardId,
  findPlayer,
  type GameState,
  type PlayerId,
  updatePlayer,
} from '@stellar/domain';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NoticeStack } from '../src/components/hud/NoticeStack.tsx';
import { PlayerRail } from '../src/components/hud/PlayerRail.tsx';
import { PlayerSheet } from '../src/components/sheet/PlayerSheet.tsx';
import { useGameStore } from '../src/game-store.ts';
import { handleShortcut } from '../src/keyboard.ts';
import { useHandStore } from '../src/hand/hand-store.ts';
import { useSettingsStore } from '../src/settings-store.ts';
import { useGalaxyStore } from '../src/store.ts';
import { useCarryStore } from '../src/table/carry-store.ts';
import { useDraftStore } from '../src/table/draft-store.ts';
import type { TableAction } from '../src/table/table-specs.ts';
import { useTableDecision } from '../src/table/use-table-decision.ts';
import { cardOf, holding } from './card-form-helpers.tsx';
import { pickAll, started } from './game-helpers.ts';
import { leaveTable, seatTable } from './local-table.ts';

const store = () => useGameStore.getState();
const game = () => store().game as GameState;
const prompt = () => screen.getByRole('region', { name: 'Entscheidung' });
const nameOf = (id: PlayerId) => findPlayer(game(), id)?.name ?? '?';
const portrait = (id: PlayerId) => screen.getByRole('button', { name: nameOf(id) });
const radio = (id: PlayerId) => screen.getByRole('radio', { name: nameOf(id) });

const MARKET = actionCardId('black-market');
const RECALL = actionCardId('recall');
const INTEL = actionCardId('intelligence');

beforeEach(() => {
  leaveTable();
  useGalaxyStore.setState({ language: 'de' });
  useSettingsStore.setState({ animations: false, tableView: true });
  const empty = { piece: null, legal: new Set<string>(), over: null, point: null, mode: null };
  useCarryStore.setState({ ...empty, news: null });
  useHandStore.getState().clear();
  useDraftStore.getState().clear();
});

afterEach(() => {
  cleanup();
  Reflect.deleteProperty(document, 'elementsFromPoint');
});

/** Eine Handlung am Entwurf, wie sie die Hand auslöst (Karte zum Ablegen antippen). */
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

/** Porträts und Ansage, die dem Spielstand folgen; das Pult auf Wunsch dazu. */
function Live(props: {
  readonly actions?: Readonly<Record<string, TableAction>>;
  readonly sheet?: boolean;
}): ReactElement | null {
  const current = useGameStore((state) => state.game);
  if (current === null) return null;
  return (
    <>
      {props.sheet === true && <PlayerSheet game={current} />}
      <PlayerRail game={current} />
      <NoticeStack game={current} />
      {Object.entries(props.actions ?? {}).map(([label, action]) => (
        <Acting key={label} state={current} label={label} action={action} />
      ))}
    </>
  );
}

/** Der Aktive hat die Karte aus der Hand gewählt und sitzt am Bildschirm. */
function choosing(mechanic: 'politics' | 'trade'): PlayerId {
  const { player, card } = holding(mechanic);
  seatTable(game(), { me: player });
  useHandStore.getState().choose({ player, card: card.id });
  return player;
}

/** Wer Sprecher werden kann: alle außer dem jetzigen, in Sitzreihenfolge. */
const candidates = (): readonly PlayerId[] =>
  game()
    .players.filter((player) => player.id !== game().speaker)
    .map((player) => player.id);

/** Die Sekundärfähigkeit der Karte steht für einen Mitspieler offen; er sitzt am Bildschirm. */
function following(
  mechanic: 'politics' | 'commandTokens' | 'diplomacy',
  strategy?: number,
): PlayerId {
  const state = pickAll(started());
  const turn = state.actionPhase as NonNullable<GameState['actionPhase']>;
  const me = state.players.find((player) => player.id !== turn.active)?.id as PlayerId;
  const secondary = { card: cardOf(mechanic).id, awaiting: [me], free: [] };
  const open = { ...state, actionPhase: { ...turn, secondary } };
  const pools = (p: GameState['players'][number]) => ({
    ...p,
    commandPools: { ...p.commandPools, strategy: strategy ?? p.commandPools.strategy },
  });
  seatTable(updatePlayer(open, me, pools), { me });
  return me;
}

/** Ein Mitspieler darf die eben gespielte Karte des Aktiven verhindern. */
function reacting(): PlayerId {
  const state = pickAll(started());
  const active = state.actionPhase?.active as PlayerId;
  const me = state.players.find((player) => player.id !== active)?.id as PlayerId;
  const reactionWindow = { kind: 'afterActivation' as const, awaiting: [me], played: [] };
  const pendingPlay = { player: active, card: MARKET, target: {}, awaiting: [me] };
  seatTable({ ...state, reactionWindow, pendingPlay }, { me });
  return me;
}

/** Der Aktive hat zwei Karten über dem Limit und sitzt am Bildschirm. */
function overLimit(): PlayerId {
  const state = pickAll(started());
  const me = state.actionPhase?.active as PlayerId;
  const size = state.config.rules.actionCardHandLimit + 2;
  const hand = [MARKET, MARKET, RECALL, ...Array.from({ length: size - 3 }, () => INTEL)];
  seatTable(
    updatePlayer(state, me, (p) => ({ ...p, actionCards: hand })),
    { me },
  );
  return me;
}

/** Das Listenelement des Porträts, auf dem der Sprechermarker liegt. */
const speakerHolder = () => document.querySelector('.speaker-token')?.closest('li');

describe('Menschen am Tisch: Sprechermarker und Freibriefe', () => {
  it('der Sprechermarker liegt als eigenes Bild auf dem Porträt des Sprechers', () => {
    const state = pickAll(started());
    seatTable(state, { me: state.actionPhase?.active as PlayerId });
    render(<Live />);
    const token = screen.getByRole('img', { name: 'Sprecher' });
    expect(token.classList.contains('speaker-token')).toBe(true);
    expect(token.querySelector('svg.speaker-face')).not.toBeNull();
    expect(document.querySelectorAll('.portrait-speaker')).toHaveLength(0);
    const holder = speakerHolder()?.querySelector('button[aria-label]');
    expect(holder?.getAttribute('aria-label')).toBe(
      findPlayer(state, state.speaker as PlayerId)?.name,
    );
    expect(screen.queryByRole('radiogroup')).toBeNull();
    expect(screen.getByRole('list', { name: 'Initiative' })).toBeTruthy();
  });

  it('Politik: der Sprechermarker auf ein anderes Porträt gelegt wählt den neuen Sprecher, Ausführen sendet ihn', () => {
    choosing('politics');
    render(<Live />);
    const [first, second] = candidates() as [PlayerId, PlayerId];
    expect(radio(first).getAttribute('aria-checked')).toBe('true');
    expect(radio(first).querySelector('.speaker-ghost')).not.toBeNull();
    const piece = screen.getByRole('button', { name: 'Marker aufnehmen: Sprechermarker' });
    expect(piece.getAttribute('data-piece')).toBe('speaker:token');
    const target = radio(second);
    Object.defineProperty(document, 'elementsFromPoint', {
      value: () => [target],
      configurable: true,
    });
    fireEvent.pointerDown(piece, { button: 0, pointerId: 1, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(piece, { pointerId: 1, clientX: 20, clientY: 40 });
    expect(target.getAttribute('data-target-state')).toBe('legal');
    fireEvent.pointerUp(piece, { pointerId: 1, clientX: 20, clientY: 40 });
    expect(radio(second).getAttribute('aria-checked')).toBe('true');
    expect(radio(first).getAttribute('aria-checked')).toBe('false');
    expect(radio(second).querySelector('.speaker-ghost')).not.toBeNull();
    expect(prompt().querySelector('.table-prompt-meter')?.textContent).toBe(
      `Neuer Sprecher: ${nameOf(second)}`,
    );
    fireEvent.click(within(prompt()).getByRole('button', { name: 'Ausführen' }));
    expect(store().error).toBeNull();
    expect(game().speaker).toBe(second);
    expect(speakerHolder()?.querySelector('button')?.getAttribute('aria-label')).toBe(
      nameOf(second),
    );
  });

  it('Politik per Tastatur: die Porträts sind eine Radiogruppe Neuer Sprecher', () => {
    choosing('politics');
    render(<Live />);
    const group = screen.getByRole('radiogroup', { name: 'Neuer Sprecher' });
    const [first, second] = candidates() as [PlayerId, PlayerId];
    // Die Gruppe besitzt genau die Kandidaten; Sprecher und Sprechermarker liegen außerhalb.
    const owned = (group.getAttribute('aria-owns') ?? '').split(' ');
    expect(owned.map((id) => document.getElementById(id))).toEqual(candidates().map(radio));
    expect(screen.queryByRole('radio', { name: nameOf(game().speaker as PlayerId) })).toBeNull();
    // Ein einziger Tab-Halt: der gewählte Kandidat.
    expect(radio(first).tabIndex).toBe(0);
    expect(radio(second).tabIndex).toBe(-1);
    fireEvent.keyDown(radio(first), { key: 'ArrowDown' });
    expect(radio(second).getAttribute('aria-checked')).toBe('true');
    expect(document.activeElement).toBe(radio(second));
    expect([radio(first).tabIndex, radio(second).tabIndex]).toEqual([-1, 0]);
    fireEvent.keyDown(radio(second), { key: 'ArrowUp' });
    expect(radio(first).getAttribute('aria-checked')).toBe('true');
    // Enter auf dem Marker nimmt ihn auf, Enter auf einem Porträt legt ihn dort ab.
    fireEvent.click(screen.getByRole('button', { name: 'Marker aufnehmen: Sprechermarker' }));
    fireEvent.keyDown(radio(second), { key: 'Enter' });
    expect(radio(second).getAttribute('aria-checked')).toBe('true');
    expect(useCarryStore.getState().piece).toBeNull();
  });

  it('Politik per Tastatur: Pfeile in der Radiogruppe verschieben die Karte nicht', () => {
    choosing('politics');
    render(<Live />);
    const panBy = vi.fn();
    const shortcuts = { generate: vi.fn(), zoomBy: vi.fn(), panBy, resetView: vi.fn() };
    const onKey = (event: KeyboardEvent) => handleShortcut(event, shortcuts);
    window.addEventListener('keydown', onKey);
    try {
      const [first, second] = candidates() as [PlayerId, PlayerId];
      fireEvent.keyDown(radio(first), { key: 'ArrowDown' });
      expect(radio(second).getAttribute('aria-checked')).toBe('true');
      expect(panBy).not.toHaveBeenCalled();
      fireEvent.keyDown(document.body, { key: 'ArrowDown' });
      expect(panBy).toHaveBeenCalledTimes(1);
    } finally {
      window.removeEventListener('keydown', onKey);
    }
  });

  it('Handel: Antippen eines Porträts gibt einen Freibrief, das Siegel sendet freeFor', () => {
    const me = choosing('trade');
    render(<Live />);
    const other = game().players.find((player) => player.id !== me)?.id as PlayerId;
    expect(portrait(me).hasAttribute('aria-pressed')).toBe(false);
    expect(portrait(other).getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(portrait(other));
    expect(portrait(other).getAttribute('aria-pressed')).toBe('true');
    expect(within(portrait(other)).getByText('Freibrief')).toBeTruthy();
    expect(screen.getByTestId('chosen-players').textContent).toBe(`Freibrief: ${nameOf(other)}`);
    fireEvent.click(within(prompt()).getByRole('button', { name: 'Ausführen' }));
    expect(store().error).toBeNull();
    expect(game().actionPhase?.secondary?.free).toEqual([other]);
  });
});

describe('Ansage: Sekundärfähigkeit, Reaktion, Ablegen', () => {
  it('Sekundärfähigkeit: die Ansage zeigt die Karte und die Kosten von einem Strategiemarker', () => {
    following('politics');
    render(<Live />);
    const socket = prompt().querySelector<HTMLElement>('.secondary-socket');
    expect(socket?.dataset['cost']).toBe('1');
    expect(socket?.dataset['affordable']).toBe('true');
    expect(socket?.textContent).toContain('Kosten: 1 Strategiemarker');
    expect(socket?.querySelector('.secondary-socket-card')).not.toBeNull();
    expect(within(prompt()).getAllByRole('button', { name: 'Ablehnen' })).toHaveLength(1);
  });

  it('ohne Strategiemarker nennt der Sockel die fehlenden Kosten', () => {
    following('politics', 0);
    render(<Live />);
    const socket = prompt().querySelector<HTMLElement>('.secondary-socket');
    expect(socket?.dataset['affordable']).toBe('false');
    expect(socket?.textContent).toContain('Kein Strategiemarker übrig');
  });

  it('Sekundärfähigkeit: Antippen des Sockels folgt der Karte und bezahlt einen Strategiemarker', () => {
    const me = following('politics');
    const before = findPlayer(game(), me);
    render(<Live />);
    const socket = within(prompt()).getByRole('button', {
      name: 'Sekundärfähigkeit nutzen: Politik',
    });
    expect(socket.getAttribute('data-target')).toBe('slot:socket');
    fireEvent.click(socket);
    expect(store().error).toBeNull();
    const after = findPlayer(game(), me);
    expect(after?.commandPools.strategy).toBe((before?.commandPools.strategy ?? 0) - 1);
    expect(after?.actionCards.length).toBeGreaterThan(before?.actionCards.length ?? 0);
  });

  it('Sekundärfähigkeit: der oberste Strategiemarker vom Pult in den Sockel gelegt folgt der Karte', () => {
    const me = following('politics');
    const before = findPlayer(game(), me)?.commandPools.strategy ?? 0;
    render(<Live sheet />);
    const piece = screen.getByRole('button', { name: 'Marker aufnehmen: Strategie' });
    const socket = within(prompt()).getByRole('button', { name: /^Sekundärfähigkeit nutzen/ });
    Object.defineProperty(document, 'elementsFromPoint', {
      value: () => [socket],
      configurable: true,
    });
    fireEvent.pointerDown(piece, { button: 0, pointerId: 1, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(piece, { pointerId: 1, clientX: 30, clientY: 40 });
    expect(socket.getAttribute('data-target-state')).toBe('legal');
    fireEvent.pointerUp(piece, { pointerId: 1, clientX: 30, clientY: 40 });
    expect(store().error).toBeNull();
    expect(findPlayer(game(), me)?.commandPools.strategy).toBe(before - 1);
    expect(game().actionPhase?.secondary?.awaiting ?? []).not.toContain(me);
  });

  it('ohne Strategiemarker bleibt der Sockel stumm und das Siegel gesperrt', () => {
    following('diplomacy', 0);
    render(<Live />);
    expect(prompt().querySelector('.secondary-socket-target')).toBeNull();
    const seal = within(prompt()).getByRole<HTMLButtonElement>('button', {
      name: 'Planeten bereitmachen',
    });
    expect(seal.disabled).toBe(true);
    expect(within(prompt()).getByRole('button', { name: 'Ablehnen' })).toBeTruthy();
  });

  it('Führung sekundär ist kostenlos', () => {
    following('commandTokens');
    render(<Live />);
    const socket = prompt().querySelector<HTMLElement>('.secondary-socket');
    expect(socket?.dataset['cost']).toBe('0');
    expect(socket?.textContent).toContain('Kosten: kostenlos');
  });

  it('klassische Ansicht zeigt keinen Sockel', () => {
    useSettingsStore.setState({ tableView: false });
    following('politics');
    render(<Live />);
    expect(document.querySelector('.secondary-socket')).toBeNull();
  });

  it('Reaktion: die Ansage zeigt die gespielte Karte und Nicht verhindern', () => {
    const me = reacting();
    render(<Live />);
    expect(within(prompt()).getByRole('heading', { name: 'Reaktion' })).toBeTruthy();
    const pending = prompt().querySelector('.table-prompt-reaction .pending-card');
    expect(pending?.textContent).toContain('hat eine Karte gespielt');
    expect(pending?.querySelector('.action-card')).not.toBeNull();
    fireEvent.click(within(prompt()).getByRole('button', { name: 'Nicht verhindern' }));
    expect(store().error).toBeNull();
    expect(game().pendingPlay?.awaiting ?? []).not.toContain(me);
  });

  it('Ablegen: die Messleiste zählt die markierten Karten', () => {
    const me = overLimit();
    const before = findPlayer(game(), me)?.actionCards.length ?? 0;
    render(
      <Live
        actions={{ Markt: { kind: 'card', card: MARKET }, Rückruf: { kind: 'card', card: RECALL } }}
      />,
    );
    expect(within(prompt()).getByRole('heading', { name: 'Aktionskarten ablegen' })).toBeTruthy();
    const seal = () => within(prompt()).getByRole<HTMLButtonElement>('button', { name: 'Ablegen' });
    expect(screen.getByTestId('discard-count').textContent).toBe('0');
    expect(prompt().querySelector('.table-prompt-meter')?.textContent).toBe('Abzulegen: 0 / 2');
    expect(seal().disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Markt' }));
    fireEvent.click(screen.getByRole('button', { name: 'Rückruf' }));
    expect(screen.getByTestId('discard-count').textContent).toBe('2');
    fireEvent.click(seal());
    expect(store().error).toBeNull();
    expect(findPlayer(game(), me)?.actionCards).toHaveLength(before - 2);
  });
});
