import type { ContentPort, TacticalStep } from '@stellar/domain';
import type { DecisionRoute } from './decision-route.ts';
import { CONSTRUCTION_SPEC } from './spec-construction.ts';
import { DIPLOMACY_SPEC } from './spec-diplomacy.ts';
import { DIPLOMACY_PRIMARY_SPEC } from './spec-diplomacy-primary.ts';
import { LEADERSHIP_SPEC } from './spec-leadership.ts';
import { IMPERIAL_SPEC, SCORING_SPEC } from './spec-objectives.ts';
import { BOMBARD_SPEC, LANDING_SPEC } from './spec-placement.ts';
import { TACTICAL_DONE_SPEC } from './spec-tactical-done.ts';
import { TOKENS_SPEC } from './spec-tokens.ts';
import { type AnySpec, type TableSpecId, widenSpec } from './spec-types.ts';
import { WARFARE_SPEC } from './spec-warfare.ts';

export type {
  AnySpec,
  ConstructionPlan,
  DonePlan,
  GhostToken,
  ObjectivePlan,
  PlacementPlan,
  PoolSpec,
  Progress,
  ReadyPlan,
  SpecAlternative,
  SpecContext,
  SystemPlan,
  TableAction,
  TableDraft,
  TablePiece,
  TableSpec,
  TableSpecId,
  TokenPlan,
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
};

/**
 * Entscheidungen, in denen ein System auf der Karte in den Entwurf geht: Kriegsführung (Marker
 * zurück) und Diplomatie (primär). Ablegen, Antippen und Enter fragen alle hier nach.
 */
const SYSTEM_SPECS: ReadonlySet<TableSpecId> = new Set<TableSpecId>([
  'warfare',
  'diplomacyPrimary',
]);

/** Ob ein System auf der Karte in den Entwurf dieser Entscheidung geht. */
export const takesSystem = (specId: TableSpecId | null): boolean =>
  specId !== null && SYSTEM_SPECS.has(specId);

/** Entscheidungen, deren Ziele Planeten im System sind: Bombardement, Landung, Infrastruktur. */
const SITE_SPECS: ReadonlySet<TableSpecId> = new Set<TableSpecId>([
  'bombard',
  'landing',
  'construction',
]);

/** Ob die Entscheidung Figuren oder Gebäude auf Planeten legt (Ringe auf der Karte). */
export const takesSite = (specId: TableSpecId | null): boolean =>
  specId !== null && SITE_SPECS.has(specId);

type ByMechanic = Readonly<Partial<Record<string, TableSpecId>>>;

/** Strategiekarten am Tisch: Führung, Imperium und Infrastruktur ganz. */
const BOTH: ByMechanic = {
  commandTokens: 'leadership',
  imperial: 'imperial',
  construction: 'construction',
};

/** Nur primär: Kriegsführung und Diplomatie (System wählen). */
const PRIMARY: ByMechanic = { warfare: 'warfare', diplomacy: 'diplomacyPrimary' };

/** Nur sekundär: Diplomatie (Planeten bereitmachen). */
const SECONDARY: ByMechanic = { diplomacy: 'diplomacy' };

/** Schritte der taktischen Aktion am Tisch: Bombardement, Landung und das Ende. */
const TACTICAL: Readonly<Partial<Record<TacticalStep, TableSpecId>>> = {
  bombardment: 'bombard',
  invasion: 'landing',
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

/** Welche Tischentscheidung zur Route gehört; `null`, wenn die Ansage das alte Formular zeigt. */
export function tableSpecOf(route: DecisionRoute, content: ContentPort): TableSpecId | null {
  if (route.kind === 'tokens' || route.kind === 'scoring') return route.kind;
  if (route.kind === 'tactical') return tacticalSpec(route.step);
  if (route.kind !== 'primary' && route.kind !== 'secondary') return null;
  return mechanicSpec(route, content);
}
