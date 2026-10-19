import { type ActionCardId, excessActionCards, findPlayer } from '@stellar/domain';
import type { DiscardPlan, SpecContext, TableAction, TableDraft, TableSpec } from './spec-types.ts';
import { actionPiece, targetKey, type TargetState } from './target-ref.ts';

/*
 * Ablegen über dem Handkartenlimit (RR 3.4): Die Hand selbst ist der Tisch. Antippen merkt ein
 * Exemplar zum Ablegen vor; liegen mehrere gleiche Karten auf der Hand, kommt bei jedem Antippen
 * eines dazu, bis keines mehr übrig ist oder genug vorgemerkt sind. Dann nimmt das nächste
 * Antippen alle Exemplare dieser Karte zurück.
 */

export type DiscardSpec = TableSpec<DiscardPlan, TableAction>;

const copiesOf = (cards: readonly ActionCardId[], card: ActionCardId): number =>
  cards.filter((other) => other === card).length;

/** Ein Exemplar mehr vormerken, solange es geht; sonst die Karte ganz zurücknehmen. */
export function toggleDiscard(
  cards: readonly ActionCardId[],
  card: ActionCardId,
  held: number,
  needed: number,
): readonly ActionCardId[] {
  if (copiesOf(cards, card) < held && cards.length < needed) return [...cards, card];
  return cards.filter((other) => other !== card);
}

/** Wie viele Exemplare einer Karte der Entwurf ablegen will; 0 ohne Ablege-Entwurf. */
export const discardCount = (draft: TableDraft | null, card: ActionCardId): number =>
  draft?.kind === 'discard' ? copiesOf(draft.cards, card) : 0;

const neededOf = (ctx: SpecContext): number => excessActionCards(ctx.game, ctx.actor);

const heldOf = (ctx: SpecContext, card: ActionCardId): number =>
  copiesOf(findPlayer(ctx.game, ctx.actor)?.actionCards ?? [], card);

function apply(ctx: SpecContext, draft: DiscardPlan, action: TableAction): DiscardPlan {
  if (action.kind !== 'card') return draft;
  const held = heldOf(ctx, action.card);
  return { kind: 'discard', cards: toggleDiscard(draft.cards, action.card, held, neededOf(ctx)) };
}

const targets = (_ctx: SpecContext, draft: DiscardPlan): ReadonlyMap<string, TargetState> =>
  new Map(draft.cards.map((card) => [targetKey(actionPiece(card)), 'chosen']));

export const DISCARD_SPEC: DiscardSpec = {
  id: 'discard',
  hint: () => 'tableHintDiscard',
  confirm: () => 'discard',
  initial: () => ({ kind: 'discard', cards: [] }),
  apply,
  targets,
  progress: (ctx, draft) => {
    const needed = neededOf(ctx);
    return { done: draft.cards.length, needed, ready: draft.cards.length === needed };
  },
  command: (ctx, draft) => ({
    type: 'DiscardActionCards',
    issuedBy: ctx.actor,
    cards: draft.cards,
  }),
};
