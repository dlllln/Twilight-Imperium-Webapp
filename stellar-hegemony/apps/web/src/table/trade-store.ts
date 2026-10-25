import { create } from 'zustand';
import { type TradeDraft, tradeDraft } from './trade-draft.ts';

/*
 * Der Entwurf der Handelsmatte. Der Schlüssel nennt Spielstand und Spieler („version|player“):
 * Nach jedem neuen Stand (auch nach einem Angebot oder Rückgängig) liegt die Matte leer.
 */

export interface TradeStore {
  readonly key: string | null;
  readonly draft: TradeDraft;
  /** Ändert den Entwurf unter dem Schlüssel; ein anderer Schlüssel beginnt mit leerer Matte. */
  readonly edit: (key: string, change: (draft: TradeDraft) => TradeDraft) => void;
  readonly clear: () => void;
}

export const tradeKey = (version: number, player: string): string => `${String(version)}|${player}`;

/** Der Entwurf zum Schlüssel; ein fremder ist eine leere Matte. */
export const draftFor = (state: Pick<TradeStore, 'key' | 'draft'>, key: string): TradeDraft =>
  state.key === key ? state.draft : tradeDraft();

export const useTradeStore = create<TradeStore>()((set) => ({
  key: null,
  draft: tradeDraft(),
  edit: (key, change) => set((state) => ({ key, draft: change(draftFor(state, key)) })),
  clear: () => set({ key: null, draft: tradeDraft() }),
}));
