import type { DonePlan, TableAction, TableSpec } from './spec-types.ts';

/*
 * Reaktion (RR 3.8–3.10): Wer im offenen Zeitfenster entscheidet, spielt eine leuchtende Karte
 * aus der Hand (das geht über die Hand selbst) oder gibt mit dem Siegel weiter. Liegt eine
 * gespielte Karte offen, heißt das Weitergeben „Nicht verhindern“.
 */

const DONE: DonePlan = { kind: 'done' };

export const REACTION_SPEC: TableSpec<DonePlan, TableAction> = {
  id: 'reaction',
  hint: () => 'tableHintReaction',
  confirm: (ctx) => (ctx.game.pendingPlay === null ? 'passReaction' : 'allowCard'),
  initial: () => DONE,
  apply: (_ctx, draft) => draft,
  targets: () => new Map(),
  progress: () => ({ done: 0, needed: 0, ready: true }),
  command: (ctx) => ({ type: 'PassReaction', issuedBy: ctx.actor }),
};
