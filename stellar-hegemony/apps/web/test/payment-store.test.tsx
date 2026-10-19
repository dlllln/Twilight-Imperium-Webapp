// @vitest-environment jsdom
import {
  type Currency,
  type GameState,
  type PlanetId,
  type PlayerId,
  spendablePlanets,
} from '@stellar/domain';
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useGameStore } from '../src/game-store.ts';
import { useHandStore } from '../src/hand/hand-store.ts';
import { useSettingsStore } from '../src/settings-store.ts';
import { content } from '../src/store.ts';
import { useDraftStore } from '../src/table/draft-store.ts';
import {
  useClaimPayment,
  usePaymentDraft,
  usePaymentStore,
  usePlanetRowShown,
  useRegisterPlanetRow,
  NO_PAYMENTS,
  openOf,
} from '../src/table/payment-store.ts';
import { usePlanetTable } from '../src/table/use-planet-table.ts';
import { pickAll, started } from './game-helpers.ts';
import { leaveTable } from './local-table.ts';

beforeEach(() => {
  useSettingsStore.setState({ tableView: true });
  usePaymentStore.setState(NO_PAYMENTS);
  useDraftStore.getState().clear();
  useHandStore.getState().clear();
});

afterEach(() => {
  cleanup();
  leaveTable();
});

/** Aktionsphase; der Aktive sitzt am Bildschirm und hat drei Handelswaren. */
function seated(): { readonly me: PlayerId; readonly planet: PlanetId } {
  const game = pickAll(started());
  const me = game.actionPhase?.active as PlayerId;
  const players = game.players.map((p) => (p.id === me ? { ...p, tradeGoods: 3 } : p));
  useGameStore.setState({ game: { ...game, players }, me });
  const [first] = spendablePlanets(game, content.tiles, me, 'resources');
  if (first === undefined) throw new Error('kein Planet');
  return { me, planet: first.planet };
}

const current = (): GameState => useGameStore.getState().game as GameState;

/** Ein Formular mit Bezahlung und daneben der Tisch, wie beide denselben Entwurf sehen. */
function useFormAndTable(me: PlayerId, claimed: boolean) {
  const game = useGameStore((state) => state.game) as GameState;
  const form = usePaymentDraft(game, me, 'resources');
  useClaimPayment(form, claimed ? me : ('niemand' as PlayerId), 4);
  return { form, table: usePlanetTable(game) };
}

/** Ein zweites Formular in derselben Währung, das ebenfalls eine Bezahlung zeigt. */
function useForm(me: PlayerId, required: number) {
  const game = useGameStore((state) => state.game) as GameState;
  const form = usePaymentDraft(game, me, 'resources');
  useClaimPayment(form, me, required);
  return form;
}

describe('Gemeinsame Bezahlung von Formular und Tisch', () => {
  it('Formular und Tisch teilen einen Entwurf', () => {
    const { me, planet } = seated();
    const { result } = renderHook(() => useFormAndTable(me, true));
    expect(result.current.table).toMatchObject({ mode: 'pay', required: 4, paid: 0 });
    act(() => result.current.table?.toggle(planet));
    expect(result.current.form.payment.planets).toEqual([planet]);
    act(() => result.current.form.setTradeGoods(2));
    expect(result.current.table?.tradeGoods).toBe(2);
    act(() => result.current.table?.addCoins(1));
    expect(result.current.form.payment.tradeGoods).toBe(3);
    expect(result.current.table?.chosen).toEqual([planet]);
    expect(result.current.table?.paid).toBe(result.current.form.value);
  });

  it('ein neuer Spielstand beginnt eine neue Bezahlung', () => {
    const { me, planet } = seated();
    const { result } = renderHook(() => useFormAndTable(me, true));
    act(() => result.current.form.togglePlanet(planet));
    expect(result.current.form.payment.planets).toEqual([planet]);
    act(() => useGameStore.setState({ game: { ...current(), version: current().version + 1 } }));
    expect(result.current.form.payment).toEqual({ planets: [], tradeGoods: 0 });
    expect(result.current.table?.chosen).toEqual([]);
  });

  it('ohne angezeigte Bezahlung bietet der Tisch keine Planeten an', () => {
    const { me } = seated();
    const other = renderHook(() => useFormAndTable(me, false));
    expect(other.result.current.table).toBeNull();
    other.unmount();
    const shown = renderHook(() => useFormAndTable(me, true));
    expect(shown.result.current.table).not.toBeNull();
    shown.unmount();
    const { result } = renderHook(() => usePlanetTable(current()));
    expect(result.current).toBeNull();
    expect(openOf(usePaymentStore.getState())).toBeNull();
  });

  it('eine andere Währung beginnt eine frische Bezahlung', () => {
    const { me, planet } = seated();
    const { result, rerender } = renderHook(
      ({ currency }: { readonly currency: Currency }) => usePaymentDraft(current(), me, currency),
      { initialProps: { currency: 'resources' as Currency } },
    );
    act(() => result.current.togglePlanet(planet));
    act(() => result.current.setTradeGoods(1));
    expect(result.current.payment).toEqual({ planets: [planet], tradeGoods: 1 });
    rerender({ currency: 'influence' });
    expect(result.current.payment).toEqual({ planets: [], tradeGoods: 0 });
  });

  it('zwei offene Formulare behalten jedes seinen Entwurf', () => {
    const { me, planet } = seated();
    const { result } = renderHook(() => ({ a: useFormAndTable(me, true), b: useForm(me, 8) }));
    act(() => result.current.a.form.togglePlanet(planet));
    act(() => result.current.b.setTradeGoods(2));
    expect(result.current.a.form.payment).toEqual({ planets: [planet], tradeGoods: 0 });
    expect(result.current.b.payment).toEqual({ planets: [], tradeGoods: 2 });
    expect(result.current.a.table).toMatchObject({ required: 8, tradeGoods: 2 });
  });

  it('schließt das zuletzt gezeigte Formular, bedient der Tisch das vorige', () => {
    const { me, planet } = seated();
    const first = renderHook(() => useFormAndTable(me, true));
    act(() => first.result.current.form.togglePlanet(planet));
    const second = renderHook(() => useForm(me, 8));
    expect(first.result.current.table).toMatchObject({ required: 8, chosen: [] });
    second.unmount();
    expect(first.result.current.table).toMatchObject({ required: 4, chosen: [planet] });
    expect(usePaymentStore.getState().drafts).not.toHaveProperty(second.result.current.key);
  });

  it('eine Planetenreihe meldet sich an und ab', () => {
    const { result } = renderHook(() => usePlanetRowShown());
    expect(result.current).toBe(false);
    const row = renderHook(() => useRegisterPlanetRow());
    expect(result.current).toBe(true);
    row.unmount();
    expect(result.current).toBe(false);
  });
});
