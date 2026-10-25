// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { useCarryStore } from '../src/table/carry-store.ts';
import { legalOver } from '../src/table/use-drag-source.ts';
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

  it('ein erlaubtes Ziel unter einem nicht erlaubten gewinnt, sonst das oberste', () => {
    const ring = element('planet:mecatol');
    const hex = element('system:18');
    const points = stack(ring, hex);
    expect(dropTargetAt({ x: 0, y: 0 }, points, new Set(['system:18']))).toEqual({
      kind: 'system',
      id: '18',
    });
    expect(dropTargetAt({ x: 0, y: 0 }, points, new Set(['slot:dock']))).toEqual({
      kind: 'planet',
      id: 'mecatol',
    });
  });

  it('beim Ziehen leuchtet nur ein erlaubtes Ziel unter dem Zeiger', () => {
    const points = stack(element('system:18'));
    useCarryStore.getState().pickUp(GOODS_PIECE, new Set(['player:p2']), 'drag');
    expect(legalOver({ x: 0, y: 0 }, points)).toBeNull();
    useCarryStore.getState().pickUp(GOODS_PIECE, new Set(['system:18']), 'drag');
    expect(legalOver({ x: 0, y: 0 }, points)).toBe('system:18');
    useCarryStore.getState().putDown();
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
    expect(parseTargetKey('goods:gold')).toBeNull();
    expect(parseTargetKey('slot:hangar')).toBeNull();
    expect(parseTargetKey('constructor:x')).toBeNull();
    const card = element('card:erobern');
    expect(dropTargetAt({ x: 0, y: 0 }, stack(card))).toEqual({ kind: 'card', id: 'erobern' });
  });
});
