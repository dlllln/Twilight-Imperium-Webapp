// @vitest-environment jsdom
import type { GameState, PlayerId, Volley } from '@stellar/domain';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { CombatLogEvent } from '../src/combat-view.ts';
import { CombatView } from '../src/components/combat/CombatView.tsx';
import { useThrownDice } from '../src/components/combat/use-dice-reveal.ts';
import { NoticeStack } from '../src/components/hud/NoticeStack.tsx';
import { BattleMat } from '../src/components/table/BattleMat.tsx';
import { useGameStore } from '../src/game-store.ts';
import { useSettingsStore } from '../src/settings-store.ts';
import { useGalaxyStore } from '../src/store.ts';
import { useCarryStore } from '../src/table/carry-store.ts';
import { useDraftStore } from '../src/table/draft-store.ts';
import { type BattleScene, hitScene, retreatScene } from './battle-scene.ts';
import { leaveTable, seatTable } from './local-table.ts';

/*
 * Kampfmatte (Tischansicht): Statt der Kampfansicht über allem liegt der Kampf in der freien
 * Mitte. Rote Stifte werden auf die eigenen Schiffe gezogen oder die Schiffe angetippt, das
 * Siegel der Ansage bestätigt; beim Rückzug merkt ein Schalter oder das leuchtende Feld das Ziel
 * vor. Der eigene Wurf liegt im Becher, bis „Würfeln“ ihn wirft.
 */

const store = () => useGameStore.getState();
const game = () => store().game as GameState;
const mat = () => screen.getByRole('region', { name: 'Kampfmatte' });
const ship = (id: string) => mat().querySelector(`[data-unit="${id}"]`) as HTMLElement;
const markOf = (id: string) => ship(id).getAttribute('data-mark');
const EMPTY = { piece: null, legal: new Set<string>(), over: null, point: null, mode: null };

beforeEach(() => {
  leaveTable();
  useGalaxyStore.setState({ language: 'de' });
  useSettingsStore.setState({ animations: false, tableView: true });
  useCarryStore.setState({ ...EMPTY, news: null });
  useDraftStore.getState().clear();
  useThrownDice.setState({ thrown: new Set() });
});

afterEach(cleanup);

function Live(): ReactElement | null {
  const current = useGameStore((state) => state.game);
  if (current === null) return null;
  return (
    <>
      <NoticeStack game={current} />
      <BattleMat game={current} />
      <CombatView />
    </>
  );
}

const volleyOf = (player: PlayerId, target: PlayerId): Volley => ({
  player,
  target,
  hits: 1,
  rolls: [{ unit: 'u' as never, type: 'cruiser' as never, hitOn: 7, results: [8] }],
});

/** Der Kampf hat begonnen; `volleys` ist der jüngste Wurf. */
function logOf(scene: BattleScene, volleys: readonly Volley[] = []): readonly CombatLogEvent[] {
  const { system, attacker, defender } = scene;
  const started = { type: 'SpaceCombatStarted', system, attacker, defender } as const;
  if (volleys.length === 0) return [started];
  return [started, { type: 'CombatRoundRolled', system, round: 1, volleys }];
}

function seat(scene: BattleScene, me: PlayerId, volleys: readonly Volley[] = []): void {
  seatTable(scene.game, { me });
  useGameStore.setState({ combatLog: logOf(scene, volleys), combatOpen: true });
  render(<Live />);
}

/** Tippt ein Schiff an, bis keine Stifte mehr darin stecken. */
function clear(id: string): void {
  for (let guard = 0; guard < 4 && markOf(id) !== 'none'; guard += 1) fireEvent.click(ship(id));
}

const pickUpPeg = () =>
  fireEvent.click(screen.getByRole('button', { name: 'Trefferstift aufnehmen' }));

describe('Kampfmatte: Trefferstifte', () => {
  it('liegt als Region in der Mitte statt als Dialog; der Vorschlag steckt schon', () => {
    const scene = hitScene();
    seat(scene, scene.attacker);
    expect(mat().dataset['deciding']).toBe('hits');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByTestId('hit-count').textContent).toBe('2');
    expect(
      within(mat()).getAllByRole('button', { name: /^(Schlachtschiff|Kreuzer): / }),
    ).toHaveLength(2);
    expect(mat().querySelector('[data-unit="feind-kreuzer"]')?.tagName).toBe('SPAN');
  });

  it('Stift aufnehmen und auf ein Schiff legen (Klick und Enter); das Siegel bestätigt', () => {
    const scene = hitScene();
    seat(scene, scene.attacker);
    clear('dread');
    clear('kreuzer');
    expect(screen.getByTestId('hit-count').textContent).toBe('0');
    pickUpPeg();
    fireEvent.click(ship('kreuzer'));
    expect(markOf('kreuzer')).toBe('destroy');
    expect(ship('kreuzer').getAttribute('aria-label')).toBe('Kreuzer: zerstören');
    pickUpPeg();
    fireEvent.keyDown(ship('dread'), { key: 'Enter' });
    expect(markOf('dread')).toBe('sustain');
    expect(screen.getByTestId('hit-count').textContent).toBe('2');
    expect(screen.queryByRole('button', { name: 'Trefferstift aufnehmen' })).toBeNull();
    fireEvent.click(screen.getByTestId('confirm'));
    expect(store().error).toBeNull();
    const left = game().systems[scene.system]?.spaceUnits.map((unit) => unit.id);
    expect(left).not.toContain('kreuzer');
  });

  it('Antippen schaltet ein Schiff weiter; „Vorschlag“ stellt die Stifte der Domain wieder her', () => {
    const scene = hitScene();
    seat(scene, scene.attacker);
    const before = [markOf('dread'), markOf('kreuzer')];
    clear('dread');
    fireEvent.click(ship('dread'));
    expect(markOf('dread')).toBe('sustain');
    fireEvent.click(screen.getByRole('button', { name: 'Vorschlag' }));
    expect([markOf('dread'), markOf('kreuzer')]).toEqual(before);
  });
});

describe('Kampfmatte: einklappen', () => {
  it('der Schalter klappt den Körper ein und wieder aus; der Kopf bleibt stehen', () => {
    const scene = hitScene();
    seat(scene, scene.attacker);
    const fold = within(mat()).getByRole('button', { name: 'Matte einklappen' });
    const body = document.getElementById(fold.getAttribute('aria-controls') ?? '');
    expect(fold.getAttribute('aria-expanded')).toBe('true');
    const ships = () =>
      within(mat()).queryAllByRole('button', { name: /^(Schlachtschiff|Kreuzer): / });
    expect(ships().every((button) => body?.contains(button))).toBe(true);
    fireEvent.click(fold);
    expect(mat().dataset['folded']).toBe('true');
    expect(ships()).toHaveLength(0);
    expect(within(mat()).getByRole('heading', { name: 'Raumkampf' })).toBeTruthy();
    fireEvent.click(within(mat()).getByRole('button', { name: 'Matte ausklappen' }));
    expect(ships()).toHaveLength(2);
  });
});

describe('Kampfmatte: Rückzug und Würfel', () => {
  it('der Verteidiger merkt ein Ziel vor und kündigt den Rückzug mit dem Siegel an', () => {
    const scene = retreatScene();
    seat(scene, scene.defender);
    expect(mat().dataset['deciding']).toBe('retreat');
    expect(screen.getByTestId('confirm').textContent).toContain('Weiterkämpfen');
    const option = screen.getByRole('button', { name: /^Rückzug nach / });
    fireEvent.click(option);
    expect(option.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTestId('confirm').textContent).toContain('Rückzug ankündigen');
    fireEvent.click(screen.getByTestId('confirm'));
    expect(store().error).toBeNull();
    const declared = store().combatLog.find((event) => event.type === 'RetreatDeclared');
    expect(declared).toMatchObject({ player: scene.defender, to: scene.refuge });
  });

  it('der eigene Wurf wartet im Becher, fremde Würfe liegen offen', () => {
    const scene = hitScene();
    seat(scene, scene.attacker, [
      volleyOf(scene.attacker, scene.defender),
      volleyOf(scene.defender, scene.attacker),
    ]);
    const dice = within(mat()).getByRole('region', { name: 'Letzter Wurf' });
    expect(within(dice).getAllByRole('button', { name: 'Würfeln' })).toHaveLength(1);
    fireEvent.click(within(dice).getByRole('button', { name: 'Würfeln' }));
    expect(within(dice).queryByRole('button', { name: 'Würfeln' })).toBeNull();
  });

  it('ohne eigene Entscheidung lässt sich die Matte schließen; die klassische Ansicht behält den Dialog', () => {
    const scene = hitScene();
    seat(scene, scene.defender);
    fireEvent.click(within(mat()).getByRole('button', { name: 'Kampfansicht schließen' }));
    expect(screen.queryByRole('region', { name: 'Kampfmatte' })).toBeNull();
    cleanup();
    useSettingsStore.setState({ tableView: false });
    seat(scene, scene.defender);
    expect(screen.getByRole('dialog', { name: 'Raumkampf' })).toBeTruthy();
  });
});
