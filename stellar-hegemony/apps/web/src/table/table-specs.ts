import type { ContentPort } from '@stellar/domain';
import type { DecisionRoute } from './decision-route.ts';
import { LEADERSHIP_SPEC } from './spec-leadership.ts';
import { TOKENS_SPEC } from './spec-tokens.ts';
import type { PoolSpec, TableSpecId } from './spec-types.ts';
import { WARFARE_SPEC } from './spec-warfare.ts';

export type {
  PoolSpec,
  Progress,
  SpecContext,
  TableAction,
  TableDraft,
  TableSpec,
  TableSpecId,
  TokenPlan,
} from './spec-types.ts';

/** Die Entscheidungen, die am Tisch gespielt werden; alle übrigen zeigt die Ansage als Formular. */
export const TABLE_SPECS: Readonly<Record<TableSpecId, PoolSpec>> = {
  tokens: TOKENS_SPEC,
  leadership: LEADERSHIP_SPEC,
  warfare: WARFARE_SPEC,
};

/** Welche Tischentscheidung zur Route gehört; `null`, wenn die Ansage das alte Formular zeigt. */
export function tableSpecOf(route: DecisionRoute, content: ContentPort): TableSpecId | null {
  if (route.kind === 'tokens') return 'tokens';
  if (route.kind !== 'primary' && route.kind !== 'secondary') return null;
  const mechanic = content.strategyCards.find((card) => card.id === route.card)?.mechanic;
  if (mechanic === 'commandTokens') return 'leadership';
  return mechanic === 'warfare' && route.kind === 'primary' ? 'warfare' : null;
}
