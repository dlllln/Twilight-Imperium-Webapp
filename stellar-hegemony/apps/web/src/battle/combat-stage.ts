import {
  findPlayer,
  type GameState,
  type PlayerId,
  shipsOf,
  type SystemId,
  type UnitCatalog,
} from '@stellar/domain';
import type { CombatLogEvent } from '../combat-view.ts';
import type { BattleShip, BattleSide } from './battle-layout.ts';
import type { RoundFire } from './battle-shots.ts';

/*
 * Brücke von der Partie zur Kampfbühne: Wer steht wo, welche Schiffe zeigt die Bühne
 * und welche Schüsse folgen aus den neuesten Ereignissen des Kampfprotokolls.
 */

export interface StageParty {
  readonly player: PlayerId;
  readonly side: BattleSide;
}

/** Verteidiger links, Angreifer rechts – wie im Simulator. */
export interface CombatStage {
  readonly left: StageParty;
  readonly right: StageParty;
}

/** Ohne Würfelergebnis bleibt nur der Jäger als Art eines zerstörten Schiffs. */
const UNKNOWN_TYPE = 'fighter';

function party(game: GameState, system: SystemId, player: PlayerId, catalog: UnitCatalog) {
  const seat = (findPlayer(game, player)?.seat ?? 0) + 1;
  const ships = shipsOf(game, system, player, catalog).map((unit): BattleShip => ({
    id: unit.id,
    type: unit.type,
    seat,
    damaged: unit.damaged,
  }));
  return { player, side: { seat, ships } };
}

/** Aufstellung des laufenden Raumkampfs; `null`, solange keiner begonnen hat. */
export function combatStage(
  game: GameState,
  system: SystemId,
  log: readonly CombatLogEvent[],
  catalog: UnitCatalog,
): CombatStage | null {
  const started = log.find((event) => event.type === 'SpaceCombatStarted');
  if (started === undefined) return null;
  return {
    left: party(game, system, started.defender, catalog),
    right: party(game, system, started.attacker, catalog),
  };
}

const isRoll = (event: CombatLogEvent) => event.type === 'CombatRoundRolled';
const isBarrage = (event: CombatLogEvent) => event.type === 'AntiFighterBarrageFired';

/**
 * Beginn der jüngsten Kampfrunde in den Ereignissen: der letzte Kampfwurf, in der ersten
 * Runde schon die Jägerabwehr davor. Ohne beides die Länge, also keine Runde.
 */
export function roundStart(events: readonly CombatLogEvent[]): number {
  const roll = events.findLastIndex(isRoll);
  const barrage = events.findIndex(isBarrage);
  const rolled = events[roll];
  const firstRound = rolled?.type === 'CombatRoundRolled' && rolled.round === 1;
  if (barrage !== -1 && (roll === -1 || firstRound)) return barrage;
  return roll === -1 ? events.length : roll;
}

/** Würfe, Jägerabwehr und Zuweisungen der jüngsten Runde als Choreografie-Eingabe. */
export function stageFire(events: readonly CombatLogEvent[]): RoundFire {
  const round = events.slice(roundStart(events));
  return {
    barrage: round.flatMap((event) => (event.type === 'AntiFighterBarrageFired' ? [event] : [])),
    volleys: round.flatMap((event) => (event.type === 'CombatRoundRolled' ? event.volleys : [])),
    assignments: round.flatMap((event) => (event.type === 'HitsAssigned' ? [event] : [])),
  };
}

/** Die Art jeder Einheit, die im Protokoll gewürfelt hat. */
function typesIn(log: readonly CombatLogEvent[]): ReadonlyMap<string, string> {
  const rolls = log.flatMap((event) => {
    if (event.type === 'CombatRoundRolled') return event.volleys.flatMap((v) => v.rolls);
    return event.type === 'AntiFighterBarrageFired' ? event.volley.rolls : [];
  });
  return new Map(rolls.map((roll) => [roll.unit, roll.type]));
}

/** Zerstörte Einheiten der Runde je Spieler (die Jägerabwehr trifft immer ihr Ziel). */
function fallenIn(fire: RoundFire): readonly { player: PlayerId; id: string }[] {
  return [
    ...fire.barrage.flatMap((entry) =>
      entry.destroyed.map((id) => ({ player: entry.volley.target, id })),
    ),
    ...fire.assignments.flatMap((entry) =>
      entry.destroyed.map((id) => ({ player: entry.player, id })),
    ),
  ];
}

type Fallen = ReturnType<typeof fallenIn>;

/** Eine Seite samt ihrer gefallenen Schiffe, die gerade nicht mehr im Spielstand stehen. */
function revive(party: StageParty, fallen: Fallen, types: ReadonlyMap<string, string>) {
  const { player, side } = party;
  const present = new Set(side.ships.map((ship) => ship.id));
  const ghosts = fallen
    .filter((entry) => entry.player === player && !present.has(entry.id))
    .map(({ id }): BattleShip => {
      return { id, type: types.get(id) ?? UNKNOWN_TYPE, seat: side.seat, damaged: false };
    });
  return { player, side: { ...side, ships: [...side.ships, ...ghosts] } };
}

/**
 * Bühne mit den in der Runde zerstörten Schiffen, damit die Schüsse sie noch treffen
 * können; nach der Salve zeigt die Bühne wieder den Stand der Partie.
 */
export function withFallen(
  stage: CombatStage,
  events: readonly CombatLogEvent[],
  log: readonly CombatLogEvent[],
): CombatStage {
  const types = typesIn(log);
  const fallen = fallenIn(stageFire(events));
  return { left: revive(stage.left, fallen, types), right: revive(stage.right, fallen, types) };
}

/** Schiffe eines Spielers auf der Bühne, als Ziele für Fehlschüsse. */
export const targetsOn =
  (stage: CombatStage) =>
  (player: PlayerId): readonly string[] =>
    [stage.left, stage.right]
      .filter((entry) => entry.player === player)
      .flatMap((entry) => entry.side.ships.map((ship) => ship.id));
