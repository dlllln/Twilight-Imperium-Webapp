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
 * Offene Bezahlungen: Formular (`PaymentPicker`) und Tisch (Planetenreihe, Planeten auf der
 * Karte, Kasse) schreiben denselben Entwurf. Jedes Formular hat seinen eigenen Entwurf unter
 * seinem Schlüssel; Spielstand und Währung bestimmen, ob er noch gilt. Der Tisch bedient das
 * zuletzt angezeigte Formular; schließt es, übernimmt das davor angezeigte.
 */

/** Eine angezeigte Bezahlung, die der Tisch mitbedient. */
export interface OpenPayment {
  readonly key: string;
  readonly player: PlayerId;
  readonly currency: Currency;
  readonly required: number;
}

/** Der Entwurf eines Formulars zu einem Spielstand. */
export interface Draft {
  readonly version: number;
  readonly plan: PaymentPlan;
}

export interface PaymentSlots {
  readonly drafts: Readonly<Record<string, Draft>>;
  /** Angezeigte Bezahlungen in der Reihenfolge des Erscheinens; die letzte bedient der Tisch. */
  readonly claims: readonly OpenPayment[];
  /** Wie viele Planetenreihen gerade angezeigt werden. */
  readonly tables: number;
}

export interface PaymentStore extends PaymentSlots {
  readonly edit: (
    key: string,
    version: number,
    currency: Currency,
    change: (plan: PaymentPlan) => PaymentPlan,
  ) => void;
  readonly drop: (key: string) => void;
  readonly claim: (open: OpenPayment) => void;
  readonly release: (key: string) => void;
  readonly addTable: () => () => void;
}

/** Leerer Stand: kein Entwurf, keine angezeigte Bezahlung, keine Planetenreihe. */
export const NO_PAYMENTS: PaymentSlots = { drafts: {}, claims: [], tables: 0 };

/** Der Entwurf zu Spielstand und Währung; passt einer nicht, ein frischer. */
export function planFor(
  draft: Draft | undefined,
  version: number,
  currency: Currency,
): PaymentPlan {
  const same = draft?.version === version && draft.plan.currency === currency;
  return same ? draft.plan : paymentPlan(currency);
}

/** Die Bezahlung, die der Tisch gerade bedient. */
export const openOf = (state: PaymentSlots): OpenPayment | null => state.claims.at(-1) ?? null;

const without = <T>(record: Readonly<Record<string, T>>, key: string) =>
  Object.fromEntries(Object.entries(record).filter(([entry]) => entry !== key));

export const usePaymentStore = create<PaymentStore>()((set) => ({
  ...NO_PAYMENTS,
  edit: (key, version, currency, change) =>
    set((state) => {
      const plan = change(planFor(state.drafts[key], version, currency));
      return { drafts: { ...state.drafts, [key]: { version, plan } } };
    }),
  drop: (key) => set((state) => ({ drafts: without(state.drafts, key) })),
  claim: (open) =>
    set((state) => ({ claims: [...state.claims.filter((c) => c.key !== open.key), open] })),
  release: (key) => set((state) => ({ claims: state.claims.filter((c) => c.key !== key) })),
  addTable: () => {
    set((state) => ({ tables: state.tables + 1 }));
    return () => set((state) => ({ tables: Math.max(0, state.tables - 1) }));
  },
}));

/** Der Entwurf eines Formulars im Store. */
export const useDraft = (key: string | null): Draft | undefined =>
  usePaymentStore((state) => (key === null ? undefined : state.drafts[key]));

/** Die Bezahlung, die der Tisch gerade bedient. */
export const useOpenPayment = (): OpenPayment | null => usePaymentStore(openOf);

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
  const plan = planFor(useDraft(key), game.version, currency);
  useEffect(() => () => usePaymentStore.getState().drop(key), [key]);
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
