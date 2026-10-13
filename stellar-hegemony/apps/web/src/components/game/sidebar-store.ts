import { create } from 'zustand';

/** Die Reiter der Übersicht am rechten Rand: Strategiekarten, Wertung, das eigene Reich, Verlauf. */
export type SidebarTab = 'turn' | 'score' | 'empire' | 'history';

/** In welchem Reiter ein Anker der Anleitung liegt; nicht genannte liegen auf der Karte. */
const TAB_OF_ANCHOR: Readonly<Record<string, SidebarTab>> = {
  strategy: 'turn',
  players: 'score',
  objectives: 'score',
  factions: 'empire',
};

interface SidebarStore {
  readonly tab: SidebarTab;
  /** Die Übersicht ist eine Schublade über der Karte; zu, solange niemand sie braucht. */
  readonly open: boolean;
  readonly setTab: (tab: SidebarTab) => void;
  /** Reiter antippen: öffnet ihn, ein zweites Antippen schließt die Schublade. */
  readonly toggle: (tab: SidebarTab) => void;
  readonly close: () => void;
  /** Öffnet den Reiter, in dem das Element der Anleitung steht. */
  readonly reveal: (anchor: string) => void;
}

export const useSidebarStore = create<SidebarStore>((set, get) => ({
  tab: 'turn',
  open: false,
  setTab: (tab) => set({ tab, open: true }),
  toggle: (tab) => {
    const { tab: current, open } = get();
    set(open && current === tab ? { open: false } : { tab, open: true });
  },
  close: () => set({ open: false }),
  reveal: (anchor) => {
    const tab = TAB_OF_ANCHOR[anchor];
    if (tab !== undefined) set({ tab, open: true });
  },
}));
