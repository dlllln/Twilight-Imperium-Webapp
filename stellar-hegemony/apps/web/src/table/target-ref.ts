import {
  COMMAND_POOLS,
  type CommandPool,
  type GameState,
  type SystemId,
  systemId,
} from '@stellar/domain';
import { type Language, translate } from '../i18n.ts';
import { systemLabel } from '../labels.ts';

/*
 * Ziele und Stücke am Tisch als reine Daten: Ein System auf der Karte oder ein Feld des Pults.
 * Der Schlüssel („system:18“, „pool:loose“) steht als `data-target` im DOM und kommt beim
 * Ablegen wieder zurück.
 */

/** Die Felder einer Markerverteilung: die drei Leisten und die Schale „Neue Marker“. */
export type DraftZone = CommandPool | 'loose';

export const DRAFT_ZONES: readonly DraftZone[] = ['loose', ...COMMAND_POOLS];

export type TargetRef =
  | { readonly kind: 'system'; readonly id: SystemId }
  | { readonly kind: 'pool'; readonly pool: DraftZone };

/** Wie ein Ziel in der laufenden Entscheidung dasteht. */
export type TargetState = 'legal' | 'chosen' | 'blocked';

/** Ein Stück wurde auf einem Ziel abgelegt; `true`, wenn das Ablegen etwas bewirkt hat. */
export type DropHandler = (piece: TargetRef, target: TargetRef) => boolean;

export const systemTarget = (id: SystemId | string): TargetRef => ({
  kind: 'system',
  id: systemId(id),
});

export const poolTarget = (pool: DraftZone): TargetRef => ({ kind: 'pool', pool });

export function targetKey(ref: TargetRef): string {
  return ref.kind === 'system' ? `system:${ref.id}` : `pool:${ref.pool}`;
}

const isZone = (value: string): value is DraftZone =>
  (DRAFT_ZONES as readonly string[]).includes(value);

/** Liest einen Schlüssel zurück; Unbekanntes ergibt `null`. */
export function parseTargetKey(key: string): TargetRef | null {
  const split = key.indexOf(':');
  const kind = key.slice(0, split);
  const value = key.slice(split + 1);
  if (split < 0 || value === '') return null;
  if (kind === 'system') return systemTarget(value);
  return kind === 'pool' && isZone(value) ? poolTarget(value) : null;
}

/** Name eines Ziels für Ansagen: Leiste, „Neue Marker“ oder System mit Planeten. */
export function targetLabel(ref: TargetRef, game: GameState, language: Language): string {
  if (ref.kind === 'system') return systemLabel(game, ref.id, language);
  return translate(language, ref.pool === 'loose' ? 'looseTokens' : ref.pool);
}
