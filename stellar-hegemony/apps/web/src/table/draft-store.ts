import { create } from 'zustand';
import type { TableDraft } from './table-specs.ts';

/**
 * Der eine Entwurf der laufenden Tischentscheidung. Der Schlüssel nennt Entscheidung und
 * Spielstand; ändert sich einer davon (auch durch Rückgängig), gilt der Entwurf nicht mehr.
 * `sent` merkt sich den Schlüssel, dessen Entwurf schon abgeschickt ist: Bis der neue Spielstand
 * ihn ablöst oder der Server ablehnt, bleibt das Siegel gesperrt und der Entwurf liegen.
 */
export interface DraftStore<D = TableDraft> {
  readonly key: string | null;
  readonly draft: D | null;
  readonly sent: string | null;
  readonly begin: (key: string, draft: D) => void;
  readonly update: (draft: D) => void;
  readonly markSent: (key: string) => void;
  readonly clear: () => void;
}

export const useDraftStore = create<DraftStore>()((set) => ({
  key: null,
  draft: null,
  sent: null,
  begin: (key, draft) => set({ key, draft }),
  update: (draft) => set({ draft }),
  markSent: (sent) => set({ sent }),
  clear: () => set({ key: null, draft: null, sent: null }),
}));
