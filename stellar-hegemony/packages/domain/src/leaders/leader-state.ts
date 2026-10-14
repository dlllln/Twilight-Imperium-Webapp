import type { LeaderId } from '../shared/ids.ts';
import type { LeaderKind } from './leader-definition.ts';

/**
 * PoK Anführer: `locked` bis zur Freischaltung, `ready`/`exhausted` für nutzbare Anführer,
 * `purged` für einen genutzten Helden. Alles ist offen sichtbar.
 */
export type LeaderStatus = 'locked' | 'ready' | 'exhausted' | 'purged';

/** Ein Anführer im Spielerzustand. */
export interface OwnedLeader {
  readonly id: LeaderId;
  readonly kind: LeaderKind;
  readonly status: LeaderStatus;
}

/** Agenten beginnen bereit, Kommandanten und Helden gesperrt. */
export const startingStatus = (kind: LeaderKind): LeaderStatus =>
  kind === 'agent' ? 'ready' : 'locked';
