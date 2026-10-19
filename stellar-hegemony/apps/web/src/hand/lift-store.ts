import { create } from 'zustand';

/*
 * Karten vor dem eigenen Platz (Relikte, Fragmente, legendäre Planeten, Anführer) werden in zwei
 * Schritten gespielt wie am echten Tisch: Das erste Antippen hebt die Karte an, erst das zweite
 * spielt sie aus. So löst ein versehentlicher Tipp keine Komponentenaktion aus.
 */

export interface LiftStore {
  /** Schlüssel der angehobenen Karte (`entryKey`); `null`, wenn keine angehoben ist. */
  readonly lifted: string | null;
  readonly lift: (key: string) => void;
  readonly lower: () => void;
}

/** Was ein Antippen bewirkt: eine andere Karte anheben oder die angehobene ausspielen. */
export const liftStep = (lifted: string | null, key: string): 'lift' | 'play' =>
  lifted === key ? 'play' : 'lift';

export const useLiftStore = create<LiftStore>()((set) => ({
  lifted: null,
  lift: (key) => set({ lifted: key }),
  lower: () => set({ lifted: null }),
}));
