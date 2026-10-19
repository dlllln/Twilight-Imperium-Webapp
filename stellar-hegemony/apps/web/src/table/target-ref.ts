import {
  COMMAND_POOLS,
  type CommandPool,
  type GameState,
  type PlanetId,
  planetId,
  type SystemId,
  systemId,
} from '@stellar/domain';
import { type Language, translate } from '../i18n.ts';
import { objectiveLabel, planetLabel, systemLabel } from '../labels.ts';

/*
 * Ziele und Stücke am Tisch als reine Daten: ein System oder Planet auf der Karte, ein Feld des
 * Pults, eine Auftragskarte, der Stapel Handelswaren oder die Kasse. Der Schlüssel („system:18“,
 * „pool:loose“, „planet:mecatol“) steht als `data-target` im DOM und kommt beim Ablegen zurück.
 */

/** Die Felder einer Markerverteilung: die drei Leisten und die Schale „Neue Marker“. */
export type DraftZone = CommandPool | 'loose';

export const DRAFT_ZONES: readonly DraftZone[] = ['loose', ...COMMAND_POOLS];

export type TargetRef =
  | { readonly kind: 'system'; readonly id: SystemId }
  | { readonly kind: 'pool'; readonly pool: DraftZone }
  | { readonly kind: 'planet'; readonly id: PlanetId }
  | { readonly kind: 'card'; readonly id: string }
  | { readonly kind: 'goods'; readonly good: 'tradeGoods' }
  | { readonly kind: 'slot'; readonly name: 'kasse' };

/** Wie ein Ziel in der laufenden Entscheidung dasteht. */
export type TargetState = 'legal' | 'chosen' | 'blocked';

/** Ein Stück wurde auf einem Ziel abgelegt; `true`, wenn das Ablegen etwas bewirkt hat. */
export type DropHandler = (piece: TargetRef, target: TargetRef) => boolean;

export const systemTarget = (id: SystemId | string): TargetRef => ({
  kind: 'system',
  id: systemId(id),
});

export const poolTarget = (pool: DraftZone): TargetRef => ({ kind: 'pool', pool });

export const planetTarget = (id: PlanetId | string): TargetRef => ({
  kind: 'planet',
  id: planetId(id),
});

/** Eine Auftragskarte auf dem Tisch (öffentlich oder geheim). */
export const cardTarget = (id: string): TargetRef => ({ kind: 'card', id });

/** Der eigene Stapel Handelswaren: Münzen werden hier aufgenommen. */
export const GOODS_PIECE: TargetRef = { kind: 'goods', good: 'tradeGoods' };

/** Die Kasse am Pult: Münzen, die in die laufende Bezahlung gehen. */
export const KASSE: TargetRef = { kind: 'slot', name: 'kasse' };

/** Der Teil hinter dem Doppelpunkt. */
function partOf(ref: TargetRef): string {
  switch (ref.kind) {
    case 'pool':
      return ref.pool;
    case 'goods':
      return ref.good;
    case 'slot':
      return ref.name;
    default:
      return ref.id;
  }
}

export const targetKey = (ref: TargetRef): string => `${ref.kind}:${partOf(ref)}`;

const isZone = (value: string): value is DraftZone =>
  (DRAFT_ZONES as readonly string[]).includes(value);

/** Je Art die Rückübersetzung des Werts; Unbekanntes ergibt `null`. */
const PARSERS: ReadonlyMap<string, (value: string) => TargetRef | null> = new Map([
  ['system', systemTarget],
  ['pool', (value: string) => (isZone(value) ? poolTarget(value) : null)],
  ['planet', planetTarget],
  ['card', cardTarget],
  ['goods', (value: string) => (value === 'tradeGoods' ? GOODS_PIECE : null)],
  ['slot', (value: string) => (value === 'kasse' ? KASSE : null)],
]);

/** Liest einen Schlüssel zurück; Unbekanntes ergibt `null`. */
export function parseTargetKey(key: string): TargetRef | null {
  const split = key.indexOf(':');
  const value = key.slice(split + 1);
  if (split < 0 || value === '') return null;
  return PARSERS.get(key.slice(0, split))?.(value) ?? null;
}

/** Name eines Ziels für Ansagen: Leiste, Schale, System, Planet, Auftrag, Handelswaren, Kasse. */
export function targetLabel(ref: TargetRef, game: GameState, language: Language): string {
  switch (ref.kind) {
    case 'system':
      return systemLabel(game, ref.id, language);
    case 'planet':
      return planetLabel(ref.id, language);
    case 'card':
      return objectiveLabel(ref.id, language);
    case 'goods':
      return translate(language, 'tradeGoods');
    case 'slot':
      return translate(language, 'kasse');
    default:
      return translate(language, ref.pool === 'loose' ? 'looseTokens' : ref.pool);
  }
}
