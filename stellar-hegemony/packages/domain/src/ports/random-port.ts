/**
 * Einzige Zufallsquelle der Domain (Dependency Inversion). Implementierungen
 * mit Seed liegen in der Infrastruktur; Tests injizieren feste Würfe.
 */
export interface RandomPort {
  /** Gleichverteilte ganze Zahl im Bereich [minInclusive, maxInclusive]. */
  nextInt(minInclusive: number, maxInclusive: number): number;
}

export function rollDie(random: RandomPort, sides: number): number {
  return random.nextInt(1, sides);
}

export function rollDice(random: RandomPort, sides: number, count: number): readonly number[] {
  return Array.from({ length: count }, () => rollDie(random, sides));
}

/** Fisher-Yates mit injiziertem Zufall, liefert eine neue Liste. */
export function shuffle<T>(random: RandomPort, items: readonly T[]): readonly T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index--) {
    const swapWith = random.nextInt(0, index);
    const current = copy[index] as T;
    copy[index] = copy[swapWith] as T;
    copy[swapWith] = current;
  }
  return copy;
}
