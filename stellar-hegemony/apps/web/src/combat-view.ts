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
      | 'UnitsDestroyed';
  }
>;

const OPENING = new Set<GameEvent['type']>(['SpaceCannonFired', 'SpaceCombatStarted']);
const FOLLOWING = new Set<GameEvent['type']>([
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

export const opensCombat = (events: readonly GameEvent[]): boolean =>
  events.some((event) => OPENING.has(event.type));

/** Seiten des Kampfs: der aktive Spieler zuerst, dann alle, die im Protokoll vorkommen. */
export function combatParties(game: GameState, log: readonly CombatLogEvent[]): PlayerId[] {
  const named = log.flatMap((event): PlayerId[] => {
    if (event.type === 'SpaceCombatStarted') return [event.attacker, event.defender];
    if (event.type === 'SpaceCannonFired') return [event.volley.player, event.volley.target];
    return [];
  });
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
