import { shuffle, type RandomPort } from '../ports/random-port.ts';
import type { PlayerId, UnitTypeId } from '../shared/ids.ts';
import type { UnitCatalog } from '../unit/unit-catalog.ts';
import { type FleetOrder, type FleetRules, validateFleet } from './fleet-order.ts';
import type { RoundPlays } from './simulated-round.ts';
import type { SimBattle, SimSide, TacticCard, TacticEffect } from './simulator-state.ts';

/** Höchstens so viele Versuche, ein weiteres Schiff unterzubringen. */
const BUILD_ATTEMPTS = 200;

/**
 * Flotte des Gegners: zufällige Schiffe, solange Ressourcen, Limit und Kapazität es
 * erlauben. Jäger nur, wenn Platz ist; so entsteht eine gemischte, gültige Flotte.
 */
export function botFleet(
  types: readonly UnitTypeId[],
  catalog: UnitCatalog,
  owner: PlayerId,
  rules: FleetRules,
  random: RandomPort,
): FleetOrder {
  let order: FleetOrder = {};
  for (let attempt = 0; attempt < BUILD_ATTEMPTS; attempt++) {
    const type = shuffle(random, types)[0];
    if (type === undefined) break;
    const next = { ...order, [type]: (order[type] ?? 0) + 1 };
    const fits = validateFleet(next, catalog, owner, rules);
    if (fits.ok || fits.error.code === 'simulator.emptyFleet') order = next;
  }
  return order;
}

/** Welche Karte der Bot in dieser Lage für sinnvoll hält, in absteigendem Nutzen. */
function useful(effect: TacticEffect, side: SimSide): boolean {
  if (effect.kind === 'repair') return side.units.some((unit) => unit.damaged);
  return true;
}

const PRIORITY: readonly TacticEffect['kind'][] = [
  'repair',
  'cancelHits',
  'combatBonus',
  'extraDice',
];

function botCard(side: SimSide, cards: readonly TacticCard[]): string | undefined {
  const inHand = cards.filter((card) => side.hand.includes(card.id) && useful(card.effect, side));
  const ranked = [...inHand].sort(
    (a, b) => PRIORITY.indexOf(a.effect.kind) - PRIORITY.indexOf(b.effect.kind),
  );
  return ranked[0]?.id;
}

/** Der Bot spielt jede Runde seine nützlichste Karte. */
export function botPlays(
  battle: SimBattle,
  bot: PlayerId,
  cards: readonly TacticCard[],
): RoundPlays {
  const side = [battle.attacker, battle.defender].find((candidate) => candidate.player === bot);
  const card = side === undefined ? undefined : botCard(side, cards);
  return card === undefined ? {} : { [bot]: card };
}
