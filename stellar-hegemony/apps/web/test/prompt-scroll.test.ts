import type { ProductionChoice } from '@stellar/domain';
import { describe, expect, it } from 'vitest';
import { fits, snappedScroll } from '../src/components/table/prompt-scroll.ts';
import { cheapFirst } from '../src/table/shipyard.ts';

/*
 * Rollen in der Ansage: so wenig wie nötig, bündig an einer Zeile, nie über den Anfang des
 * Bausteins hinaus. Dazu die Folge der Steine in der Werft.
 */

describe('Rollen in der Ansage', () => {
  const rows = [0, 6, 50, 90];

  it('passt alles, bleibt die Ansage oben', () => {
    expect(snappedScroll({ least: -40, most: 120, rows, current: 0 })).toBe(0);
  });

  it('steht schon alles im Bild, bleibt die Ansage, wo sie ist', () => {
    expect(snappedScroll({ least: 20, most: 120, rows, current: 33 })).toBe(33);
  });

  it('von oben gerollt wird bis zur ersten Zeile, die den Baustein ganz zeigt', () => {
    expect(snappedScroll({ least: 37, most: 120, rows, current: 0 })).toBe(50);
  });

  it('von unten gerollt wird bis zur letzten Zeile, an der sein Anfang steht', () => {
    expect(snappedScroll({ least: 10, most: 95, rows, current: 200 })).toBe(90);
  });

  it('ohne passende Zeile genau so weit wie nötig', () => {
    expect(snappedScroll({ least: 37, most: 45, rows, current: 0 })).toBe(37);
  });

  it('ist der Baustein höher als die Ansage, steht sein Anfang oben', () => {
    const plan = { least: 200, most: 120, rows, current: 0 };
    expect(fits(plan)).toBe(false);
    expect(snappedScroll(plan)).toBe(120);
  });
});

const choice = (id: string, resources: number, unitsPerCost = 1) =>
  ({ unit: { id, cost: { resources, unitsPerCost } } }) as unknown as ProductionChoice;

describe('Folge der Steine in der Werft', () => {
  it('die günstigsten Einheiten liegen vorn, gleich teure behalten ihre Folge', () => {
    const choices = [
      choice('carrier', 3),
      choice('fighter', 1, 2),
      choice('cruiser', 2),
      choice('mech', 2),
      choice('infantry', 1, 2),
    ];
    const order = cheapFirst(choices).map((entry) => String(entry.unit.id));
    expect(order).toEqual(['fighter', 'infantry', 'cruiser', 'mech', 'carrier']);
  });
});
