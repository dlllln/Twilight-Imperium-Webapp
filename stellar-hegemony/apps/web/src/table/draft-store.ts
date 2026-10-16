import { create } from 'zustand';
import type { TableDraft } from './table-specs.ts';

/**
 * Der eine Entwurf der laufenden Tischentscheidung. Der Schlüssel nennt Entscheidung und
 * Spielstand; ändert sich einer davon (auch durch Rückgängig), gilt der Entwurf nicht mehr.
 */
export interface DraftStore<D = TableDraft> {
  readonly key: string | null;
  readonly draft: D | null;
  readonly begin: (key: string, draft: D) => void;
  readonly update: (draft: D) => void;
  readonly clear: () => void;
}

export const useDraftStore = create<DraftStore>()((set) => ({
  key: null,
  draft: null,
  begin: (key, draft) => set({ key, draft }),
  update: (draft) => set({ draft }),
  clear: () => set({ key: null, draft: null }),
}));
