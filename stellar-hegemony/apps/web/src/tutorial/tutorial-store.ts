import { create } from 'zustand';
import { TUTORIAL_STEPS } from './tutorial-steps.ts';

export interface TutorialStore {
  readonly open: boolean;
  readonly step: number;
  readonly start: () => void;
  readonly next: () => void;
  readonly previous: () => void;
  readonly close: () => void;
}

const LAST = TUTORIAL_STEPS.length - 1;

export const useTutorialStore = create<TutorialStore>()((set, get) => ({
  open: false,
  step: 0,
  start: () => set({ open: true, step: 0 }),
  next: () => set({ step: Math.min(LAST, get().step + 1) }),
  previous: () => set({ step: Math.max(0, get().step - 1) }),
  close: () => set({ open: false }),
}));
