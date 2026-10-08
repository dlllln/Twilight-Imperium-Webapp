import { create } from 'zustand';

/** Die drei Reiter der Seitenleiste: was jetzt zu tun ist, die Wertung, das eigene Reich. */
export type SidebarTab = 'turn' | 'score' | 'empire';

/** In welchem Reiter ein Anker der Anleitung liegt; nicht genannte liegen außerhalb der Leiste. */
const TAB_OF_ANCHOR: Readonly<Record<string, SidebarTab>> = {
  turn: 'turn',
  strategy: 'turn',
  hand: 'turn',
  players: 'score',
  objectives: 'score',
  factions: 'empire',
};

interface SidebarStore {
  readonly tab: SidebarTab;
  readonly setTab: (tab: SidebarTab) => void;
  /** Öffnet den Reiter, in dem das Element der Anleitung steht. */
  readonly reveal: (anchor: string) => void;
}

export const useSidebarStore = create<SidebarStore>((set) => ({
  tab: 'turn',
  setTab: (tab) => set({ tab }),
  reveal: (anchor) => {
    const tab = TAB_OF_ANCHOR[anchor];
    if (tab !== undefined) set({ tab });
  },
}));
