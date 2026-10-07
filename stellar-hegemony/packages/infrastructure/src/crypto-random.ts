import type { RandomPort } from '@stellar/domain';

const UINT32 = 0x1_0000_0000;

/** Kryptografischer Zufall für Online-Partien: niemand kann künftige Würfe vorhersagen. */
export class CryptoRandom implements RandomPort {
  nextInt(minInclusive: number, maxInclusive: number): number {
    const span = maxInclusive - minInclusive + 1;
    // Verwerfen statt Modulo: jeder Wert im Bereich bleibt gleich wahrscheinlich.
    const limit = UINT32 - (UINT32 % span);
    const buffer = new Uint32Array(1);
    let value = UINT32;
    while (value >= limit) value = globalThis.crypto.getRandomValues(buffer)[0] ?? UINT32;
    return minInclusive + (value % span);
  }
}
