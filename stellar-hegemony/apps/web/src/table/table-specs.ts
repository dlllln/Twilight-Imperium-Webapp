import type { ContentPort } from '@stellar/domain';
import type { DecisionRoute } from './decision-route.ts';
import { DIPLOMACY_SPEC } from './spec-diplomacy.ts';
import { LEADERSHIP_SPEC } from './spec-leadership.ts';
import { IMPERIAL_SPEC, SCORING_SPEC } from './spec-objectives.ts';
import { TOKENS_SPEC } from './spec-tokens.ts';
import { type AnySpec, type TableSpecId, widenSpec } from './spec-types.ts';
import { WARFARE_SPEC } from './spec-warfare.ts';

export type {
  AnySpec,
  ObjectivePlan,
  PoolSpec,
  Progress,
  ReadyPlan,
  SpecAlternative,
  SpecContext,
  TableAction,
  TableDraft,
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
};

/** Strategiekarten am Tisch: Führung und Imperium ganz, Kriegsführung primär, Diplomatie sekundär. */
function mechanicSpec(
  mechanic: string | undefined,
  kind: 'primary' | 'secondary',
): TableSpecId | null {
  if (mechanic === 'commandTokens') return 'leadership';
  if (mechanic === 'imperial') return 'imperial';
  if (kind === 'primary') return mechanic === 'warfare' ? 'warfare' : null;
  return mechanic === 'diplomacy' ? 'diplomacy' : null;
}

/** Welche Tischentscheidung zur Route gehört; `null`, wenn die Ansage das alte Formular zeigt. */
export function tableSpecOf(route: DecisionRoute, content: ContentPort): TableSpecId | null {
  if (route.kind === 'tokens' || route.kind === 'scoring') return route.kind;
  if (route.kind !== 'primary' && route.kind !== 'secondary') return null;
  const mechanic = content.strategyCards.find((card) => card.id === route.card)?.mechanic;
  return mechanicSpec(mechanic, route.kind);
}
