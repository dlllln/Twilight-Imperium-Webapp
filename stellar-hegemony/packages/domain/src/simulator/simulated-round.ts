import { boosted } from '../action-card/combat-bonus.ts';
import { barrageShooters, combatShooters } from '../combat/combat-queries.ts';
import { rollVolley, type Shooter, type Volley } from '../combat/dice.ts';
import { suggestHitAssignment } from '../combat/hit-assignment.ts';
import type { RandomPort } from '../ports/random-port.ts';
import { type Check, type DomainError, firstFailure, guard } from '../shared/domain-error.ts';
import type { PlayerId, UnitId } from '../shared/ids.ts';
import { map, type Result } from '../shared/result.ts';
import type { UnitCatalog } from '../unit/unit-catalog.ts';
import { damageUnit, repairUnit } from '../unit/unit.ts';
import {
  type BarrageReport,
  type BattleOutcome,
  type SimBattle,
  type SimRoundReport,
  type SimSide,
  sidesOf,
  type TacticCard,
  type TacticEffect,
} from './simulator-state.ts';

export interface SimContext {
  readonly random: RandomPort;
  readonly dieSides: number;
  readonly catalog: UnitCatalog;
  readonly cards: readonly TacticCard[];
}

/** Gespielte Taktikkarten dieser Runde je Spieler (höchstens eine). */
export type RoundPlays = Readonly<Partial<Record<PlayerId, string>>>;

type Sides = readonly [SimSide, SimSide];

/** Beide Seiten haben noch Schiffe: der Kampf geht weiter. */
const BOTH = 2;

const effectsOf = (side: SimSide, plays: RoundPlays, cards: readonly TacticCard[]) =>
  cards.filter((card) => card.id === plays[side.player]).map((card) => card.effect);

const total = (
  effects: readonly TacticEffect[],
  kind: 'combatBonus' | 'cancelHits' | 'extraDice',
) => effects.reduce((sum, effect) => sum + (effect.kind === kind ? effect.amount : 0), 0);

function playChecks(battle: SimBattle, plays: RoundPlays, cards: readonly TacticCard[]) {
  const legal = sidesOf(battle).every((side) => {
    const card = plays[side.player];
    return card === undefined || (side.hand.includes(card) && cards.some((c) => c.id === card));
  });
  return [
    guard(battle.outcome === null, 'simulator.finished', 'Der Kampf ist entschieden'),
    guard(legal, 'simulator.cardNotInHand', 'Karte nicht auf der Hand'),
  ] satisfies readonly Check[];
}

/** Feldreparatur vor den Würfen: beschädigte Schiffe sind wieder heil. */
function repaired(side: SimSide, effects: readonly TacticEffect[]): SimSide {
  if (!effects.some((effect) => effect.kind === 'repair')) return side;
  return { ...side, units: side.units.map(repairUnit) };
}

/** RR 41: In der ersten Runde schießen Zerstörer auf Jäger; Treffer zerstören Jäger. */
function barrageOf(shooter: SimSide, target: SimSide, context: SimContext): BarrageReport | null {
  const shooters = barrageShooters(shooter.units, context.catalog);
  if (shooters.length === 0) return null;
  const players = { player: shooter.player, target: target.player };
  const volley = rollVolley(context.random, context.dieSides, shooters, players);
  const fighters = target.units.filter(
    (unit) => context.catalog.find(unit.type, unit.owner)?.isFighter === true,
  );
  return { volley, destroyed: fighters.slice(0, volley.hits).map((unit) => unit.id) };
}

const without = (side: SimSide, ids: ReadonlySet<UnitId>): SimSide => ({
  ...side,
  units: side.units.filter((unit) => !ids.has(unit.id)),
});

/** Überladung: das treffsicherste Schiff würfelt zusätzliche Würfel. */
function withExtraDice(shooters: readonly Shooter[], amount: number): readonly Shooter[] {
  if (amount === 0 || shooters.length === 0) return shooters;
  const best = [...shooters].sort((a, b) => a.profile.hitOn - b.profile.hitOn)[0];
  return shooters.map((shooter) =>
    shooter === best
      ? { ...shooter, profile: { ...shooter.profile, dice: shooter.profile.dice + amount } }
      : shooter,
  );
}

function volleyOf(
  side: SimSide,
  target: SimSide,
  effects: readonly TacticEffect[],
  context: SimContext,
): Volley {
  const base = boosted(combatShooters(side.units, context.catalog), total(effects, 'combatBonus'));
  const shooters = withExtraDice(base, total(effects, 'extraDice'));
  const players = { player: side.player, target: target.player };
  return rollVolley(context.random, context.dieSides, shooters, players);
}

/** RR 89.1/66: Treffer abfangen, zuerst mit Schadensresistenz, dann die günstigsten Schiffe. */
function absorb(side: SimSide, hits: number, catalog: UnitCatalog) {
  const assignment = suggestHitAssignment(side.units, hits, catalog);
  const lost = new Set(assignment.destroyed);
  const hurt = new Set(assignment.sustained);
  const units = side.units
    .filter((unit) => !lost.has(unit.id))
    .map((unit) => (hurt.has(unit.id) ? damageUnit(unit) : unit));
  return { side: { ...side, units }, assignment: { player: side.player, ...assignment } };
}

function outcomeOf([attacker, defender]: Sides): BattleOutcome {
  const alive = [attacker, defender].filter((side) => side.units.length > 0);
  if (alive.length === BOTH) return null;
  return alive[0]?.player ?? 'draw';
}

type EffectPair = readonly [readonly TacticEffect[], readonly TacticEffect[]];

interface Prepared {
  readonly sides: Sides;
  readonly effects: EffectPair;
  readonly repaired: readonly UnitId[];
}

/** Karten abwerfen und Feldreparatur ausführen, bevor geschossen wird. */
function prepare(battle: SimBattle, plays: RoundPlays, cards: readonly TacticCard[]): Prepared {
  const before = sidesOf(battle);
  const effects = [effectsOf(before[0], plays, cards), effectsOf(before[1], plays, cards)] as const;
  const ready = (side: SimSide, own: readonly TacticEffect[]): SimSide => ({
    ...repaired(side, own),
    hand: side.hand.filter((card) => card !== plays[side.player]),
  });
  const fixedBy = (side: SimSide, own: readonly TacticEffect[]) =>
    own.some((effect) => effect.kind === 'repair') ? side.units.filter((u) => u.damaged) : [];
  const repairedIds = [...fixedBy(before[0], effects[0]), ...fixedBy(before[1], effects[1])];
  return {
    sides: [ready(before[0], effects[0]), ready(before[1], effects[1])],
    effects,
    repaired: repairedIds.map((unit) => unit.id),
  };
}

function barrageRound(sides: Sides, round: number, context: SimContext) {
  const [attacker, defender] = sides;
  if (round !== 1) return { sides, barrage: [] };
  const reports = [barrageOf(attacker, defender, context), barrageOf(defender, attacker, context)];
  const barrage = reports.filter((report): report is BarrageReport => report !== null);
  const lost = new Set(barrage.flatMap((report) => report.destroyed));
  return { sides: [without(attacker, lost), without(defender, lost)] as Sides, barrage };
}

/** Treffer eines Schützen auf ein Ziel, abzüglich der Notschilde des Ziels. */
function strike(volley: Volley, target: SimSide, shields: number, catalog: UnitCatalog) {
  const cancelled = Math.min(volley.hits, shields);
  return { ...absorb(target, volley.hits - cancelled, catalog), cancelled };
}

/** Beide Seiten würfeln gleichzeitig; erst danach werden Treffer abgefangen (RR 63.5). */
function exchangeFire(sides: Sides, effects: EffectPair, context: SimContext) {
  const [attacker, defender] = sides;
  const volleys = [
    volleyOf(attacker, defender, effects[0], context),
    volleyOf(defender, attacker, effects[1], context),
  ] as const;
  const onDefender = strike(volleys[0], defender, total(effects[1], 'cancelHits'), context.catalog);
  const onAttacker = strike(volleys[1], attacker, total(effects[0], 'cancelHits'), context.catalog);
  return {
    sides: [onAttacker.side, onDefender.side] as Sides,
    volleys,
    cancelled: [
      { player: defender.player, hits: onDefender.cancelled },
      { player: attacker.player, hits: onAttacker.cancelled },
    ],
    assignments: [onDefender.assignment, onAttacker.assignment],
  };
}

const playedCards = (battle: SimBattle, plays: RoundPlays) =>
  sidesOf(battle).flatMap((side) => {
    const card = plays[side.player];
    return card === undefined ? [] : [{ player: side.player, card }];
  });

function resolveRound(battle: SimBattle, plays: RoundPlays, context: SimContext) {
  const round = battle.round + 1;
  const prepared = prepare(battle, plays, context.cards);
  const opened = barrageRound(prepared.sides, round, context);
  const fire = exchangeFire(opened.sides, prepared.effects, context);
  const [attacker, defender] = fire.sides;
  const report: SimRoundReport = {
    round,
    played: playedCards(battle, plays),
    repaired: prepared.repaired,
    barrage: opened.barrage,
    volleys: fire.volleys,
    cancelled: fire.cancelled,
    assignments: fire.assignments,
  };
  return { battle: { attacker, defender, round, outcome: outcomeOf(fire.sides) }, report };
}

/**
 * Eine Kampfrunde: Taktikkarten, in Runde 1 die Jägerabwehr, dann würfeln beide Seiten
 * gleichzeitig; Treffer werden nach dem Vorschlag der Domain abgefangen.
 */
export function fightRound(
  battle: SimBattle,
  plays: RoundPlays,
  context: SimContext,
): Result<{ readonly battle: SimBattle; readonly report: SimRoundReport }, DomainError> {
  return map(firstFailure(playChecks(battle, plays, context.cards)), () =>
    resolveRound(battle, plays, context),
  );
}
