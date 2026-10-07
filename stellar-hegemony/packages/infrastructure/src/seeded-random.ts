import type { RandomPort } from '@stellar/domain';

const UINT32 = 0x1_0000_0000;
const MULBERRY_INCREMENT = 0x6d2b79f5;

/**
 * Deterministischer Zufallsgenerator (Mulberry32). Gleicher Seed ⇒ gleiche
 * Würfe; damit sind Partien reproduzierbar und testbar.
 */
export class SeededRandom implements RandomPort {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  nextInt(minInclusive: number, maxInclusive: number): number {
    const span = maxInclusive - minInclusive + 1;
    return minInclusive + Math.floor(this.nextFraction() * span);
  }

  private nextFraction(): number {
    this.state = (this.state + MULBERRY_INCREMENT) >>> 0;
    let mixed = this.state;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / UINT32;
  }
}
