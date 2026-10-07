import { describe, expect, it } from 'vitest';
import { strategyCardsPerPlayer, validateGameConfig } from '../src/index.ts';
import { config } from './fixtures.ts';

describe('GameConfig (Varianten über Konfiguration)', () => {
  it('RR 68: 10 oder 14 Siegpunkte sind erlaubt, andere Ziele nicht', () => {
    expect(validateGameConfig(config(6, 10)).ok).toBe(true);
    expect(validateGameConfig(config(6, 14)).ok).toBe(true);
    expect(validateGameConfig(config(6, 12))).toMatchObject({
      ok: false,
      error: { code: 'config.victoryPoints' },
    });
  });

  it('Spielerzahl muss im erlaubten Bereich liegen', () => {
    expect(validateGameConfig(config(2)).ok).toBe(false);
    expect(validateGameConfig(config(7)).ok).toBe(false);
    expect(validateGameConfig(config(3)).ok).toBe(true);
  });

  it('RR 76: bei höchstens vier Spielern wählt jeder zwei Strategiekarten', () => {
    expect(strategyCardsPerPlayer(config(3))).toBe(2);
    expect(strategyCardsPerPlayer(config(4))).toBe(2);
    expect(strategyCardsPerPlayer(config(5))).toBe(1);
  });
});
