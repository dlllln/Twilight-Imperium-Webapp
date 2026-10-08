import {
  BASE_RULE_NUMBERS,
  SIMULATOR_RULES,
  SIMULATOR_SHIPS,
  TACTIC_CARDS,
} from '@stellar/content';
import {
  type BattleOutcome,
  botFleet,
  botPlays,
  factionId,
  fightRound,
  type FleetOrder,
  playerId,
  type RoundPlays,
  type SimBattle,
  type SimContext,
  simulatorCatalog,
  startBattle,
  type UnitCatalog,
} from '@stellar/domain';
import { SeededRandom } from '@stellar/infrastructure';
import { content } from '../store.ts';

/** Du greifst rechts an, der KI-Gegner verteidigt links. */
export const YOU = playerId('sim-you');
export const RIVAL = playerId('sim-rival');
const YOUR_SEAT = 1;
const RIVAL_SEAT = 2;

/** Platzfarbe einer Seite: du in der ersten, der Gegner in der zweiten Farbe. */
export const seatOf = (player: string): number => (player === YOU ? YOUR_SEAT : RIVAL_SEAT);
const BATTLE_SEED_STEP = 997;
const ROUND_SEED_STEP = 31;

export const catalogFor = (you: string, rival: string): UnitCatalog =>
  simulatorCatalog(content, { [YOU]: factionId(you), [RIVAL]: factionId(rival) });

const contextFor = (catalog: UnitCatalog, seed: number): SimContext => ({
  random: new SeededRandom(seed),
  dieSides: BASE_RULE_NUMBERS.dieSides,
  catalog,
  cards: TACTIC_CARDS,
});

/** Der Gegner baut seine Flotte nach denselben Regeln wie du. */
export function rivalFleet(catalog: UnitCatalog, seed: number): FleetOrder {
  const random = new SeededRandom(seed);
  return botFleet(SIMULATOR_SHIPS, catalog, RIVAL, SIMULATOR_RULES, random);
}

export function newBattle(order: FleetOrder, catalog: UnitCatalog, seed: number): SimBattle {
  return startBattle(
    { player: YOU, order },
    { player: RIVAL, order: rivalFleet(catalog, seed) },
    TACTIC_CARDS,
  );
}

/** Eine Runde mit deiner Karte (oder keiner) und der Karte des Gegners. */
export function playRound(
  battle: SimBattle,
  card: string | null,
  catalog: UnitCatalog,
  seed: number,
) {
  const plays: RoundPlays = {
    ...botPlays(battle, RIVAL, TACTIC_CARDS),
    ...(card === null ? {} : { [YOU]: card }),
  };
  const roundSeed = seed + battle.round * ROUND_SEED_STEP;
  return fightRound(battle, plays, contextFor(catalog, roundSeed));
}

export const battleSeed = (seed: number, index: number): number => seed + index * BATTLE_SEED_STEP;

/** Gewonnene Kämpfe je Seite; die Serie ist entschieden, sobald eine Seite die Mehrheit hat. */
export function seriesScore(results: readonly BattleOutcome[]) {
  const you = results.filter((outcome) => outcome === YOU).length;
  const rival = results.filter((outcome) => outcome === RIVAL).length;
  const needed = Math.floor(SIMULATOR_RULES.battles / 2) + 1;
  const over = you >= needed || rival >= needed || results.length >= SIMULATOR_RULES.battles;
  return { you, rival, over };
}
