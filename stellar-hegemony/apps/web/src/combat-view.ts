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
  technologyCatalog,
  type Unit,
  type Volley,
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
      | 'CenterTokenRemoved'
      | 'CombatBonusGranted'
      | 'HitsCancelled';
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
  'CombatBonusGranted',
  'HitsCancelled',
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

const isLogged = (event: GameEvent): event is CombatLogEvent =>
  OPENING.has(event.type) || FOLLOWING.has(event.type);

/** Kämpfe nur zwischen KI-Gegnern öffnen die Ansicht nicht; ein Mensch muss beteiligt sein. */
export function involvesHuman(
  game: GameState,
  events: readonly GameEvent[],
  bots: readonly PlayerId[],
): boolean {
  const named = events.filter(isLogged).flatMap(namedIn);
  const active = game.actionPhase?.active;
  const parties = active == null ? named : [active, ...named];
  return parties.some((player) => !bots.includes(player));
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
  const catalog = technologyCatalog(game, content);
  const pending = tactical.pendingHits.find((entry) => entry.player === player);
  if (pending === undefined) {
    const targets = retreatTargets(game, tactical.system, player, catalog);
    return { kind: 'retreat', player, targets };
  }
  const units = shipsOf(game, tactical.system, player, catalog);
  const suggestion = suggestHitAssignment(units, pending.hits, catalog);
  return { kind: 'hits', player, hits: pending.hits, units, suggestion };
}

/** Die Salven eines Protokolleintrags: eine (Kanonen, Jägerabwehr, Bombardement) oder mehrere. */
function volleysOf(event: CombatLogEvent): readonly Volley[] {
  if ('volleys' in event) return event.volleys;
  return 'volley' in event ? [event.volley] : [];
}

/** Die Würfe des jüngsten Wurfs im Protokoll, für die Würfelschale der Kampfmatte. */
export function latestVolleys(log: readonly CombatLogEvent[]): readonly Volley[] {
  const latest = [...log].reverse().find((event) => volleysOf(event).length > 0);
  return latest === undefined ? [] : volleysOf(latest);
}

/** Wer im System kämpft: Aktiver, Verteidiger des Raumkampfs und alle aus dem Protokoll. */
export function battleSides(game: GameState, log: readonly CombatLogEvent[]): PlayerId[] {
  const defender = game.actionPhase?.tactical?.combat?.defender;
  const sides = [...combatParties(game, log), ...(defender == null ? [] : [defender])];
  return [...new Set(sides)];
}

export type CombatRole = 'attacker' | 'defender' | 'bystander';

/** Rolle einer Seite: der Aktive greift an, der Verteidiger steht im Raumkampf oder im System. */
export function combatRole(
  game: GameState,
  log: readonly CombatLogEvent[],
  player: PlayerId,
): CombatRole {
  if (game.actionPhase?.active === player) return 'attacker';
  return defenderOf(game, log) === player ? 'defender' : 'bystander';
}

/** Verteidiger laut Protokoll, sonst laut laufendem Raumkampf. */
function defenderOf(game: GameState, log: readonly CombatLogEvent[]): PlayerId | null {
  const started = log.find((event) => event.type === 'SpaceCombatStarted');
  return started?.defender ?? game.actionPhase?.tactical?.combat?.defender ?? null;
}

/** Das erste Ereignis des Protokolls nennt immer das umkämpfte System. */
export function combatSystemOf(log: readonly CombatLogEvent[]): SystemId | null {
  const first = log[0];
  return first !== undefined && 'system' in first ? first.system : null;
}
