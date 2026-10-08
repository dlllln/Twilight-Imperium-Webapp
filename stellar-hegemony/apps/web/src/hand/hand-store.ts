import type { PlayerId, StrategyCardId } from '@stellar/domain';
import { create } from 'zustand';

/** Eine aus der Hand gespielte strategische Aktion, deren Formular noch offen ist. */
export interface ChosenStrategy {
  readonly player: PlayerId;
  readonly card: StrategyCardId;
}

interface HandStore {
  readonly chosen: ChosenStrategy | null;
  readonly choose: (chosen: ChosenStrategy) => void;
  readonly clear: () => void;
}

/** Verbindet Hand und Seitenleiste: die Karte wählt, die Seitenleiste fragt die Einzelheiten. */
export const useHandStore = create<HandStore>()((set) => ({
  chosen: null,
  choose: (chosen) => set({ chosen }),
  clear: () => set({ chosen: null }),
}));
