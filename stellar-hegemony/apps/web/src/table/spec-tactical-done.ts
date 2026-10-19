import type { DonePlan, TableAction, TableSpec } from './spec-types.ts';

/*
 * Ende der taktischen Aktion: Alle Schritte sind erledigt, es bleibt nur das Siegel.
 * Sichtbar steht in der Ansage genau einmal der bekannte Satz „Alle Schritte … erledigt“
 * (`DoneLine`); der Hinweis hier sagt Bildschirmlesern, was zu tun bleibt.
 */

const DONE: DonePlan = { kind: 'done' };

export const TACTICAL_DONE_SPEC: TableSpec<DonePlan, TableAction> = {
  id: 'tacticalDone',
  hint: () => 'tableHintTacticalDone',
  confirm: () => 'endTactical',
  initial: () => DONE,
  apply: (_ctx, draft) => draft,
  targets: () => new Map(),
  progress: () => ({ done: 0, needed: 0, ready: true }),
  command: (ctx) => ({ type: 'EndTacticalAction', issuedBy: ctx.actor }),
};
