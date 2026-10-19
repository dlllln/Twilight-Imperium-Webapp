// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { dropTargetAt } from '../src/table/drop-target.ts';
import {
  cardTarget,
  GOODS_PIECE,
  KASSE,
  parseTargetKey,
  planetTarget,
  targetKey,
} from '../src/table/target-ref.ts';

/** Elemente, wie sie unter einem Punkt übereinander liegen (oberstes zuerst). */
function stack(...elements: Element[]) {
  return { elementsFromPoint: () => elements };
}

function element(target?: string, parent?: Element): Element {
  const node = document.createElement('div');
  if (target !== undefined) node.setAttribute('data-target', target);
  parent?.appendChild(node);
  return node;
}

describe('Ziel unter dem Zeiger', () => {
  it('findet das System unter dem Zeiger', () => {
    const hex = element('system:18');
    const label = element(undefined, hex);
    expect(dropTargetAt({ x: 4, y: 2 }, stack(label, hex))).toEqual({ kind: 'system', id: '18' });
  });

  it('nimmt das oberste Ziel und überspringt Elemente ohne Ziel', () => {
    const ghost = element();
    const tray = element('pool:fleet');
    const map = element('system:7');
    expect(dropTargetAt({ x: 0, y: 0 }, stack(ghost, tray, map))).toEqual({
      kind: 'pool',
      pool: 'fleet',
    });
    expect(dropTargetAt({ x: 0, y: 0 }, stack(ghost))).toBeNull();
  });

  it('unbekannte Zielschlüssel ergeben null', () => {
    const odd = element('nebel:x');
    const broken = element('pool:bank');
    const empty = element('system:');
    expect(dropTargetAt({ x: 0, y: 0 }, stack(odd, broken, empty))).toBeNull();
  });

  it('Planeten-, Karten-, Münz- und Kassenschlüssel lassen sich zurücklesen', () => {
    const refs = [planetTarget('mecatol'), cardTarget('erobern'), GOODS_PIECE, KASSE];
    expect(refs.map(targetKey)).toEqual([
      'planet:mecatol',
      'card:erobern',
      'goods:tradeGoods',
      'slot:kasse',
    ]);
    for (const ref of refs) expect(parseTargetKey(targetKey(ref))).toEqual(ref);
    expect(parseTargetKey('goods:commodities')).toBeNull();
    expect(parseTargetKey('slot:dock')).toBeNull();
    expect(parseTargetKey('constructor:x')).toBeNull();
    const card = element('card:erobern');
    expect(dropTargetAt({ x: 0, y: 0 }, stack(card))).toEqual({ kind: 'card', id: 'erobern' });
  });
});
