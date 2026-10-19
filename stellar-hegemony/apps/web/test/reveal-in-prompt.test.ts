import { describe, expect, it } from 'vitest';
import { revealDelta } from '../src/components/table/use-reveal-in-prompt.ts';

/** Ein Rechteck nur mit Ober- und Unterkante; mehr braucht die Rechnung nicht. */
const box = (top: number, bottom: number) => ({ top, bottom }) as DOMRect;

describe('Ansage rollt zur Bezahlung', () => {
  it('rollt so weit, dass das Formular bis zum Ende sichtbar ist', () => {
    expect(revealDelta(box(400, 680), box(690, 712), box(300, 790))).toBe(118);
  });

  it('rollt nie über die Messleiste hinaus', () => {
    expect(revealDelta(box(500, 800), box(900, 920), box(300, 1400))).toBe(392);
  });

  it('steht alles schon im Bild, bleibt die Ansage stehen', () => {
    expect(revealDelta(box(400, 800), box(500, 520), box(300, 700))).toBe(0);
  });
});
