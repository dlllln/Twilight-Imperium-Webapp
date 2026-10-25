import {
  NO_PAYMENT,
  planetId,
  type ProductionChoice,
  systemId,
  type UnitDefinition,
  unitTypeId,
} from '@stellar/domain';
import { describe, expect, it } from 'vitest';
import { togglePlanet } from '../src/table/payment-draft.ts';
import {
  groundOf,
  needsGround,
  order,
  orderedCount,
  ordersOf,
  productionPlan,
  requestOf,
  withGround,
} from '../src/table/production-draft.ts';
import { content } from '../src/store.ts';

const HOME = systemId('home');
const ALPHA = planetId('alpha');
const BETA = planetId('beta');
const INFANTRY = unitTypeId('infantry');
const CRUISER = unitTypeId('cruiser');

const unitOf = (type: string): UnitDefinition => {
  const found = content.units.find(unitTypeId(type));
  if (found === undefined) throw new Error(`Einheit ${type} fehlt`);
  return found;
};

const choice = (type: string, canAdd = true): ProductionChoice => ({
  unit: unitOf(type),
  ordered: 0,
  canAdd,
  supply: null,
});

const CHOICES = [choice('infantry'), choice('cruiser')];

describe('Entwurf der Werft', () => {
  it('zu Beginn ist das Dock leer und die Bezahlung offen in Ressourcen', () => {
    const plan = productionPlan(HOME);
    expect(plan).toMatchObject({
      kind: 'production',
      system: HOME,
      orders: {},
      groundPlanet: null,
    });
    expect(plan.payment).toMatchObject({ currency: 'resources', planets: [], tradeGoods: 0 });
    expect(ordersOf(plan)).toEqual([]);
    expect(orderedCount(plan)).toBe(0);
  });

  it('Einheiten werden je Art gezählt und als Bestellung gesendet', () => {
    const plan = [INFANTRY, INFANTRY, CRUISER].reduce(
      (current, type) => order(current, CHOICES, type, 1),
      productionPlan(HOME),
    );
    expect(plan.orders).toEqual({ infantry: 2, cruiser: 1 });
    expect(orderedCount(plan)).toBe(3);
    expect(ordersOf(plan)).toEqual([
      { type: INFANTRY, count: 2 },
      { type: CRUISER, count: 1 },
    ]);
  });

  it('ohne Platz laut Domain kommt keine Einheit dazu, unbekannte Arten auch nicht', () => {
    const plan = productionPlan(HOME);
    expect(order(plan, [choice('cruiser', false)], CRUISER, 1)).toBe(plan);
    expect(order(plan, CHOICES, unitTypeId('nix'), 1)).toBe(plan);
  });

  it('zurücknehmen geht nur, was bestellt ist; ein leeres Dock beginnt die Bezahlung neu', () => {
    const one = order(productionPlan(HOME), CHOICES, CRUISER, 1);
    const paid = { ...one, payment: togglePlanet(one.payment, ALPHA, [ALPHA]) };
    const empty = order(paid, CHOICES, CRUISER, -1);
    expect(empty.orders).toEqual({});
    expect(empty.payment.planets).toEqual([]);
    expect(order(empty, CHOICES, CRUISER, -1)).toBe(empty);
  });

  it('eine Bodentruppe auf einem Planeten bestellt legt dort neue Bodentruppen ab', () => {
    const plan = order(productionPlan(HOME), CHOICES, INFANTRY, 1, BETA);
    expect(plan.groundPlanet).toBe(BETA);
    expect(needsGround(plan, CHOICES)).toBe(true);
    expect(needsGround(order(productionPlan(HOME), CHOICES, CRUISER, 1), CHOICES)).toBe(false);
  });

  it('ohne Wahl gilt der erste mögliche Planet, eine ungültige Wahl wird nicht übernommen', () => {
    const plan = productionPlan(HOME);
    expect(groundOf(plan, [ALPHA, BETA])).toBe(ALPHA);
    expect(groundOf(withGround(plan, BETA, [ALPHA, BETA]), [ALPHA, BETA])).toBe(BETA);
    expect(withGround(plan, BETA, [ALPHA])).toBe(plan);
    expect(groundOf(plan, [])).toBeNull();
  });

  it('ohne Bestellung wird nichts bezahlt und kein Planet genannt', () => {
    const plan = { ...productionPlan(HOME), groundPlanet: ALPHA };
    expect(requestOf(plan, ALPHA, true)).toEqual({
      orders: [],
      payment: NO_PAYMENT,
      groundPlanet: null,
    });
    const ships = order(productionPlan(HOME), CHOICES, CRUISER, 1);
    expect(requestOf(ships, ALPHA, false).groundPlanet).toBeNull();
    const troops = order(productionPlan(HOME), CHOICES, INFANTRY, 1);
    expect(requestOf(troops, ALPHA, true)).toMatchObject({ groundPlanet: ALPHA });
  });
});
