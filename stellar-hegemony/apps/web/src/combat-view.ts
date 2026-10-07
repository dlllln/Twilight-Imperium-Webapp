import {
  type ContentPort,
  type GameEvent,
  type GameState,
  type HitAssignment,
  type PlayerId,
  retreatTargets,
  shipsOf,
  suggestHitAssignment,
  type SystemId,
  tacticalDecider,
  type Unit,
} from '@stellar/domain';

/** Ereignisse, die die Kampfansicht als Protokoll zeigt. */
export type CombatLogEvent = Extract<
  GameEvent,
  {
    type:
      | 'SpaceCannonFired'
      | 'SpaceCombatStarted'
      | 'AntiFighterBarrageFired'
      | 'RetreatDeclared'
      | 'CombatRoundRolled'
      | 'HitsAssigned'
      | 'ShipsRetreated'
      | 'SpaceCombatEnded'
      | 'UnitsDestroyed'
      | 'BombardmentRolled'
      | 'GroundForcesCommitted'
      | 'SpaceCannonDefenseFired'
      | 'GroundCombatRoundRolled'
      | 'GroundCombatEnded'
      | 'PlanetControlGained'
      | 'CenterTokenRemoved';
  }
>;

/** Ereignisse, die ein Protokoll eröffnen: Kanonenfeuer, Raumkampf, Bombardement, Einmarsch. */
const OPENING = new Set<GameEvent['type']>([
  'SpaceCannonFired',
  'SpaceCombatStarted',
  'BombardmentRolled',
  'GroundForcesCommitted',
]);
const FOLLOWING = new Set<GameEvent['type']>([
  'SpaceCannonDefenseFired',
  'GroundCombatRoundRolled',
  'GroundCombatEnded',
  'PlanetControlGained',
  'CenterTokenRemoved',
  'AntiFighterBarrageFired',
  'RetreatDeclared',
  'CombatRoundRolled',
  'HitsAssigned',
  'ShipsRetreated',
  'SpaceCombatEnded',
  'UnitsDestroyed',
]);

const logs = (log: readonly CombatLogEvent[], event: GameEvent): event is CombatLogEvent =>
  OPENING.has(event.type) || (log.length > 0 && FOLLOWING.has(event.type));

/**
 * Protokoll der laufenden Taktikaktion: beginnt bei Kanonenfeuer oder Kampfbeginn
 * und wird mit jeder neuen Aktivierung geleert.
 */
export function nextCombatLog(
  log: readonly CombatLogEvent[],
  events: readonly GameEvent[],
): readonly CombatLogEvent[] {
  return events.reduce<readonly CombatLogEvent[]>((current, event) => {
    if (event.type === 'SystemActivated') return [];
    return logs(current, event) ? [...current, event] : current;
  }, log);
}

/** Die Ansicht öffnet sich nur, wenn gewürfelt wird; eine Landung ohne Kampf bleibt im Protokoll. */
const ROLLS = new Set<GameEvent['type']>([
  'SpaceCannonFired',
  'SpaceCombatStarted',
  'BombardmentRolled',
  'SpaceCannonDefenseFired',
  'GroundCombatRoundRolled',
]);

export const opensCombat = (events: readonly GameEvent[]): boolean =>
  events.some((event) => ROLLS.has(event.type));

/** Spieler, die ein Protokolleintrag nennt (für die Seiten der Kampfansicht). */
function namedIn(event: CombatLogEvent): readonly PlayerId[] {
  switch (event.type) {
    case 'SpaceCombatStarted':
      return [event.attacker, event.defender];
    case 'SpaceCannonFired':
    case 'BombardmentRolled':
    case 'SpaceCannonDefenseFired':
      return [event.volley.player, event.volley.target];
    case 'GroundCombatRoundRolled':
      return event.volleys.map((volley) => volley.player);
    default:
      return [];
  }
}

/** Gab es im Protokoll einen Raumkampf oder Kanonenfeuer im Weltraum? */
export const isSpaceBattle = (log: readonly CombatLogEvent[]): boolean =>
  log.some((event) => event.type === 'SpaceCombatStarted' || event.type === 'SpaceCannonFired');

/** Seiten des Kampfs: der aktive Spieler zuerst, dann alle, die im Protokoll vorkommen. */
export function combatParties(game: GameState, log: readonly CombatLogEvent[]): PlayerId[] {
  const named = log.flatMap(namedIn);
  const active = game.actionPhase?.active;
  return [...new Set(active == null ? named : [active, ...named])];
}

export type CombatDecision =
  | {
      readonly kind: 'hits';
      readonly player: PlayerId;
      readonly hits: number;
      readonly units: readonly Unit[];
      readonly suggestion: HitAssignment;
    }
  | { readonly kind: 'retreat'; readonly player: PlayerId; readonly targets: readonly SystemId[] };

/** Welche Entscheidung die Kampfansicht gerade abfragt (oder null). */
export function combatDecision(game: GameState, content: ContentPort): CombatDecision | null {
  const tactical = game.actionPhase?.tactical;
  const player = tacticalDecider(game);
  if (tactical == null || player === null) return null;
  const catalog = content.units;
  const pending = tactical.pendingHits.find((entry) => entry.player === player);
  if (pending === undefined) {
    const targets = retreatTargets(game, tactical.system, player, catalog);
    return { kind: 'retreat', player, targets };
  }
  const units = shipsOf(game, tactical.system, player, catalog);
  const suggestion = suggestHitAssignment(units, pending.hits, catalog);
  return { kind: 'hits', player, hits: pending.hits, units, suggestion };
}
