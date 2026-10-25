import {
  combatChoiceOf,
  type ContentPort,
  type GameState,
  type TacticalStep,
} from '@stellar/domain';
import type { DecisionRoute } from './decision-route.ts';
import { TIE_SPEC, VOTE_SPEC } from './spec-agenda.ts';
import { HITS_SPEC, RETREAT_SPEC } from './spec-battle.ts';
import { CONSTRUCTION_SPEC } from './spec-construction.ts';
import { DISCARD_SPEC } from './spec-discard.ts';
import { DIPLOMACY_SPEC } from './spec-diplomacy.ts';
import { DIPLOMACY_PRIMARY_SPEC } from './spec-diplomacy-primary.ts';
import { LEADERSHIP_SPEC } from './spec-leadership.ts';
import { IMPERIAL_SPEC, SCORING_SPEC } from './spec-objectives.ts';
import { POLITICS_SPEC, TRADE_SPEC } from './spec-people.ts';
import { BOMBARD_SPEC, LANDING_SPEC } from './spec-placement.ts';
import { PRODUCTION_SPEC, WARFARE_SECONDARY_SPEC } from './spec-production.ts';
import { REACTION_SPEC } from './spec-reaction.ts';
import { TECHNOLOGY_SPEC } from './spec-research.ts';
import { TACTICAL_DONE_SPEC } from './spec-tactical-done.ts';
import { TOKENS_SPEC } from './spec-tokens.ts';
import { type AnySpec, type TableSpecId, widenSpec } from './spec-types.ts';
import { WARFARE_SPEC } from './spec-warfare.ts';

export type {
  AnySpec,
  ConstructionPlan,
  DiscardPlan,
  DonePlan,
  GhostToken,
  HitPlan,
  ObjectivePlan,
  OutcomePlan,
  PlacementPlan,
  PlayersPlan,
  PoolSpec,
  ProductionPlan,
  Progress,
  ReadyPlan,
  ResearchPlan,
  SpecAlternative,
  SpecContext,
  SystemPlan,
  TableAction,
  TableDraft,
  TablePiece,
  TableSpec,
  TableSpecId,
  TokenPlan,
  VotePlan,
} from './spec-types.ts';

/** Die Entscheidungen, die am Tisch gespielt werden; alle übrigen zeigt die Ansage als Formular. */
export const TABLE_SPECS: Readonly<Record<TableSpecId, AnySpec>> = {
  tokens: widenSpec(TOKENS_SPEC, 'tokens'),
  leadership: widenSpec(LEADERSHIP_SPEC, 'tokens'),
  warfare: widenSpec(WARFARE_SPEC, 'tokens'),
  scoring: widenSpec(SCORING_SPEC, 'objective'),
  imperial: widenSpec(IMPERIAL_SPEC, 'objective'),
  diplomacy: widenSpec(DIPLOMACY_SPEC, 'ready'),
  bombard: widenSpec(BOMBARD_SPEC, 'placement'),
  landing: widenSpec(LANDING_SPEC, 'placement'),
  tacticalDone: widenSpec(TACTICAL_DONE_SPEC, 'done'),
  diplomacyPrimary: widenSpec(DIPLOMACY_PRIMARY_SPEC, 'system'),
  construction: widenSpec(CONSTRUCTION_SPEC, 'construction'),
  discard: widenSpec(DISCARD_SPEC, 'discard'),
  reaction: widenSpec(REACTION_SPEC, 'done'),
  politics: widenSpec(POLITICS_SPEC, 'players'),
  trade: widenSpec(TRADE_SPEC, 'players'),
  production: widenSpec(PRODUCTION_SPEC, 'production'),
  warfareSecondary: widenSpec(WARFARE_SECONDARY_SPEC, 'production'),
  technology: widenSpec(TECHNOLOGY_SPEC, 'research'),
  hits: widenSpec(HITS_SPEC, 'hits'),
  retreat: widenSpec(RETREAT_SPEC, 'system'),
  vote: widenSpec(VOTE_SPEC, 'vote'),
  tieBreak: widenSpec(TIE_SPEC, 'outcome'),
};

/**
 * Entscheidungen, in denen ein System auf der Karte in den Entwurf geht: Kriegsführung (Marker
 * zurück), Diplomatie (primär) und der Rückzug. Ablegen, Antippen und Enter fragen alle hier nach.
 */
const SYSTEM_SPECS: ReadonlySet<TableSpecId> = new Set<TableSpecId>([
  'warfare',
  'diplomacyPrimary',
  'retreat',
]);

/** Ob ein System auf der Karte in den Entwurf dieser Entscheidung geht. */
export const takesSystem = (specId: TableSpecId | null): boolean =>
  specId !== null && SYSTEM_SPECS.has(specId);

/**
 * Entscheidungen, deren Ziele Planeten im System sind: Bombardement, Landung, Infrastruktur und
 * die Werft (Bodentruppen auf Planeten mit Produktion).
 */
const SITE_SPECS: ReadonlySet<TableSpecId> = new Set<TableSpecId>([
  'bombard',
  'landing',
  'construction',
  'production',
  'warfareSecondary',
]);

/** Ob die Entscheidung Figuren oder Gebäude auf Planeten legt (Ringe auf der Karte). */
export const takesSite = (specId: TableSpecId | null): boolean =>
  specId !== null && SITE_SPECS.has(specId);

/**
 * Entscheidungen, in denen ein Mitspieler (sein Bild) in den Entwurf geht: Politik, Handel und
 * die Abstimmung (bei einer Wahl ist das Porträt die Ergebnisplatte des Spielers).
 */
const PLAYER_SPECS: ReadonlySet<TableSpecId> = new Set<TableSpecId>(['politics', 'trade', 'vote']);

/** Ob ein Mitspieler auf der Spielerleiste in den Entwurf dieser Entscheidung geht. */
export const takesPlayer = (specId: TableSpecId | null): boolean =>
  specId !== null && PLAYER_SPECS.has(specId);

type ByMechanic = Readonly<Partial<Record<string, TableSpecId>>>;

/** Strategiekarten am Tisch: Führung, Imperium, Infrastruktur und Technologie ganz. */
const BOTH: ByMechanic = {
  commandTokens: 'leadership',
  imperial: 'imperial',
  construction: 'construction',
  technology: 'technology',
};

/**
 * Nur primär: Kriegsführung, Diplomatie (System wählen), Politik (neuer Sprecher) und Handel
 * (Freibriefe). Die Sekundärfähigkeiten von Politik und Handel bleiben eine Zeile der Ansage.
 */
const PRIMARY: ByMechanic = {
  warfare: 'warfare',
  diplomacy: 'diplomacyPrimary',
  politics: 'politics',
  trade: 'trade',
};

/** Nur sekundär: Diplomatie (Planeten bereitmachen) und Kriegsführung (Werft im Heimatsystem). */
const SECONDARY: ByMechanic = { diplomacy: 'diplomacy', warfare: 'warfareSecondary' };

/** Schritte der taktischen Aktion am Tisch: Bombardement, Landung, Produktion und das Ende. */
const TACTICAL: Readonly<Partial<Record<TacticalStep, TableSpecId>>> = {
  bombardment: 'bombard',
  invasion: 'landing',
  production: 'production',
  done: 'tacticalDone',
};

function mechanicSpec(route: DecisionRoute, content: ContentPort): TableSpecId | null {
  const mechanic = content.strategyCards.find((card) => card.id === route.card)?.mechanic;
  if (mechanic === undefined) return null;
  const own = route.kind === 'primary' ? PRIMARY : SECONDARY;
  return BOTH[mechanic] ?? own[mechanic] ?? null;
}

const tacticalSpec = (step: TacticalStep | null): TableSpecId | null =>
  step === null ? null : (TACTICAL[step] ?? null);

/**
 * Routen, deren Art schon die Tischentscheidung ist: Marker, Wertung, Ablegen, Reaktion,
 * Abstimmung und Gleichstand.
 */
const DIRECT: Readonly<Partial<Record<DecisionRoute['kind'], TableSpecId>>> = {
  tokens: 'tokens',
  scoring: 'scoring',
  discard: 'discard',
  reaction: 'reaction',
  vote: 'vote',
  tieBreak: 'tieBreak',
};

/**
 * Im Kampf entscheidet der Spielstand, ob Treffer zugewiesen oder ein Rückzug angekündigt wird;
 * Angreifer (taktische Route) und Verteidiger (Kampfroute) spielen dieselbe Kampfmatte.
 */
function combatSpec(route: DecisionRoute, game: GameState | null): TableSpecId | null {
  if (game === null || route.actor === null) return null;
  return combatChoiceOf(game, route.actor);
}

/** Welche Tischentscheidung zur Route gehört; `null`, wenn die Ansage das alte Formular zeigt. */
export function tableSpecOf(
  route: DecisionRoute,
  content: ContentPort,
  game: GameState | null = null,
): TableSpecId | null {
  const direct = DIRECT[route.kind];
  if (direct !== undefined) return direct;
  if (route.kind === 'combat') return combatSpec(route, game);
  if (route.kind === 'tactical') return combatSpec(route, game) ?? tacticalSpec(route.step);
  if (route.kind !== 'primary' && route.kind !== 'secondary') return null;
  return mechanicSpec(route, content);
}
