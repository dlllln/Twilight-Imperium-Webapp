import type { Volley } from '@stellar/domain';
import { useEffect, useMemo, useState } from 'react';
import { useSettingsStore } from '../../settings-store.ts';

export const DICE_REVEAL_MS = 940;
const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

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

/** Nur eine kurze Darstellung bereits feststehender Würfe; sie blockiert keinen Spielzug. */
export function useDiceReveal(volley: Volley): { rolling: boolean; finish: () => void } {
  const animations = useSettingsStore((state) => state.animations);
  const reduced = useReducedDiceMotion();
  const signature = JSON.stringify(volley);
  const hasDice = volley.rolls.some((roll) => roll.results.length > 0);
  const [revealed, setRevealed] = useState<string | null>(null);
  const rolling = animations && !reduced && hasDice && revealed !== signature;
  useEffect(() => {
    if (!rolling) {
      setRevealed(signature);
      return;
    }
    const timer = window.setTimeout(() => setRevealed(signature), DICE_REVEAL_MS);
    return () => window.clearTimeout(timer);
  }, [signature, rolling]);
  return { rolling, finish: () => setRevealed(signature) };
}
