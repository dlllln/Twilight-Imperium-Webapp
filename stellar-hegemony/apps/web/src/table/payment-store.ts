import type { Currency, GameState, Payment, PlanetId, PlayerId } from '@stellar/domain';
import { useEffect, useId } from 'react';
import { create } from 'zustand';
import {
  addCoins,
  ownTradeGoods,
  paymentOf,
  type PaymentPlan,
  paymentPlan,
  paymentValueOf,
  spendableIds,
  togglePlanet,
} from './payment-draft.ts';

/*
 * Die eine Bezahlung, die gerade offen ist: Formular (`PaymentPicker`) und Tisch (Planetenreihe,
 * Planeten auf der Karte, Kasse) schreiben denselben Entwurf. Schlüssel, Spielstand und Währung
 * bestimmen, ob der Entwurf noch gilt; sonst beginnt eine neue Bezahlung, ohne Aufräumcode.
 */

/** Eine angezeigte Bezahlung, die der Tisch mitbedient. */
export interface OpenPayment {
  readonly key: string;
  readonly player: PlayerId;
  readonly currency: Currency;
  readonly required: number;
}

export interface PaymentStore {
  readonly key: string | null;
  readonly version: number | null;
  readonly plan: PaymentPlan | null;
  readonly open: OpenPayment | null;
  /** Wie viele Planetenreihen gerade angezeigt werden. */
  readonly tables: number;
  readonly edit: (
    key: string,
    version: number,
    currency: Currency,
    change: (plan: PaymentPlan) => PaymentPlan,
  ) => void;
  readonly claim: (open: OpenPayment) => void;
  readonly release: (key: string) => void;
  readonly addTable: () => () => void;
}

export interface Stamp {
  readonly key: string | null;
  readonly version: number | null;
  readonly plan: PaymentPlan | null;
}

/** Der Entwurf zu Schlüssel, Spielstand und Währung; passt einer nicht, ein frischer. */
export function planFor(
  stamp: Stamp,
  key: string,
  version: number,
  currency: Currency,
): PaymentPlan {
  const { plan } = stamp;
  const same = stamp.key === key && stamp.version === version && plan?.currency === currency;
  return same ? plan : paymentPlan(currency);
}

export const usePaymentStore = create<PaymentStore>()((set, get) => ({
  key: null,
  version: null,
  plan: null,
  open: null,
  tables: 0,
  edit: (key, version, currency, change) =>
    set((state) => ({ key, version, plan: change(planFor(state, key, version, currency)) })),
  claim: (open) => set({ open }),
  release: (key) => {
    if (get().open?.key === key) set({ open: null });
  },
  addTable: () => {
    set((state) => ({ tables: state.tables + 1 }));
    return () => set((state) => ({ tables: Math.max(0, state.tables - 1) }));
  },
}));

/** Der Stand des Entwurfs im Store. */
export function useStamp(): Stamp {
  const key = usePaymentStore((state) => state.key);
  const version = usePaymentStore((state) => state.version);
  const plan = usePaymentStore((state) => state.plan);
  return { key, version, plan };
}

/** Was ein Bezahlformular braucht; der Wert kommt aus der Domain. */
export interface PaymentState {
  readonly key: string;
  readonly currency: Currency;
  readonly payment: Payment;
  readonly value: number;
  readonly togglePlanet: (planet: PlanetId) => void;
  readonly setTradeGoods: (amount: number) => void;
}

type Editors = Pick<PaymentState, 'togglePlanet' | 'setTradeGoods'>;

/** Änderungen eines Formulars am gemeinsamen Entwurf. */
function editorsOf(game: GameState, player: PlayerId, currency: Currency, key: string): Editors {
  const edit = (change: (current: PaymentPlan) => PaymentPlan) => {
    usePaymentStore.getState().edit(key, game.version, currency, change);
  };
  return {
    togglePlanet: (planet) =>
      edit((p) => togglePlanet(p, planet, spendableIds(game, player, currency))),
    setTradeGoods: (amount) =>
      edit((p) => addCoins(p, amount - p.tradeGoods, ownTradeGoods(game, player))),
  };
}

/** Der gemeinsame Entwurf aus Sicht eines Formulars; jedes Formular hat seinen Schlüssel. */
export function usePaymentDraft(
  game: GameState,
  player: PlayerId,
  currency: Currency,
): PaymentState {
  const key = useId();
  const plan = planFor(useStamp(), key, game.version, currency);
  return {
    key,
    currency,
    payment: paymentOf(plan),
    value: paymentValueOf(game, player, plan),
    ...editorsOf(game, player, currency, key),
  };
}

/** Solange das Formular steht, bedient der Tisch diese Bezahlung mit. */
export function useClaimPayment(state: PaymentState, player: PlayerId, required: number): void {
  const { key, currency } = state;
  useEffect(() => {
    usePaymentStore.getState().claim({ key, player, currency, required });
    return () => {
      usePaymentStore.getState().release(key);
    };
  }, [key, player, currency, required]);
}

/** Meldet eine angezeigte Planetenreihe an, solange sie steht. */
export function useRegisterPlanetRow(): void {
  useEffect(() => usePaymentStore.getState().addTable(), []);
}

/** Ob gerade eine Planetenreihe angezeigt wird (dann kann das Formular schlanker sein). */
export const usePlanetRowShown = (): boolean => usePaymentStore((state) => state.tables > 0);
