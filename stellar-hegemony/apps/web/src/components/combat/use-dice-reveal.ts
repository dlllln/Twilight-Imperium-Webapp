import type { Volley } from '@stellar/domain';
import { useEffect, useMemo, useState } from 'react';
import { create } from 'zustand';
import { useSettingsStore } from '../../settings-store.ts';

export const DICE_REVEAL_MS = 940;
const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

/**
 * Würfe, die am Tisch schon mit „Würfeln“ aus dem Becher geholt wurden. Die Kampfmatte zeichnet
 * ihre Schale bei jeder neuen Entscheidung neu; ein schon geworfener Wurf liegt dann offen.
 */
interface ThrownStore {
  readonly thrown: ReadonlySet<string>;
  readonly throwDice: (signature: string) => void;
}

export const useThrownDice = create<ThrownStore>()((set) => ({
  thrown: new Set(),
  throwDice: (signature) => set((state) => ({ thrown: new Set([...state.thrown, signature]) })),
}));

function useReducedDiceMotion(): boolean {
  const query = useMemo(
    () => (typeof window.matchMedia === 'function' ? window.matchMedia(REDUCED_MOTION) : null),
    [],
  );
  const [reduced, setReduced] = useState(query?.matches ?? false);
  useEffect(() => {
    if (query === null) return;
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, [query]);
  return reduced;
}

export interface DiceReveal {
  readonly rolling: boolean;
  /** Der Wurf liegt noch verdeckt im Becher und wartet auf „Würfeln“. */
  readonly held: boolean;
  readonly finish: () => void;
  readonly roll: () => void;
}

/**
 * Nur eine kurze Darstellung bereits feststehender Würfe; sie blockiert keinen Spielzug. Mit
 * `gated` (der eigene Wurf am Tisch) bleiben die Würfel im Becher, bis „Würfeln“ gedrückt wird;
 * fremde Würfe und die der KI decken sich von selbst auf.
 */
export function useDiceReveal(volley: Volley, gated = false): DiceReveal {
  const animations = useSettingsStore((state) => state.animations);
  const reduced = useReducedDiceMotion();
  const signature = JSON.stringify(volley);
  const hasDice = volley.rolls.some((roll) => roll.results.length > 0);
  const held = useThrownDice((state) => gated && hasDice && !state.thrown.has(signature));
  const [revealed, setRevealed] = useState<string | null>(null);
  const rolling = animations && !reduced && hasDice && !held && revealed !== signature;
  useEffect(() => {
    if (held) return;
    if (!rolling) {
      setRevealed(signature);
      return;
    }
    const timer = window.setTimeout(() => setRevealed(signature), DICE_REVEAL_MS);
    return () => window.clearTimeout(timer);
  }, [signature, rolling, held]);
  const roll = () => useThrownDice.getState().throwDice(signature);
  return { rolling, held, finish: () => setRevealed(signature), roll };
}
