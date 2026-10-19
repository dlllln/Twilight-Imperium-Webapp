import {
  COMMAND_POOLS,
  type CommandPool,
  type GameState,
  locateUnit,
  type PlanetId,
  planetId,
  type SystemId,
  systemId,
  type UnitId,
  unitId,
  type UnitTypeId,
  unitTypeId,
} from '@stellar/domain';
import { type Language, translate } from '../i18n.ts';
import { objectiveLabel, planetLabel, systemLabel, unitLabel } from '../labels.ts';

/*
 * Ziele und Stücke am Tisch als reine Daten: ein System oder Planet auf der Karte, ein Feld des
 * Pults, eine Auftragskarte, der Stapel Handelswaren, die Kasse, eine Figur, ein Gebäude aus dem
 * Bauvorrat oder der Weltraum des aktivierten Systems. Der Schlüssel („system:18“, „pool:loose“,
 * „planet:mecatol“) steht als `data-target` im DOM und kommt beim Ablegen zurück. Ein Planet als
 * Bezahlung heißt „planet:“, ein Planet als Ziel für Figuren und Gebäude „site:“.
 */

/** Die Felder einer Markerverteilung: die drei Leisten und die Schale „Neue Marker“. */
export type DraftZone = CommandPool | 'loose';

/** Ablagen ohne eigene Kennung: die Kasse am Pult und der Weltraum des aktivierten Systems. */
export type SlotName = 'kasse' | 'space';

export const DRAFT_ZONES: readonly DraftZone[] = ['loose', ...COMMAND_POOLS];

export type TargetRef =
  | { readonly kind: 'system'; readonly id: SystemId }
  | { readonly kind: 'pool'; readonly pool: DraftZone }
  | { readonly kind: 'planet'; readonly id: PlanetId }
  | { readonly kind: 'card'; readonly id: string }
  | { readonly kind: 'goods'; readonly good: 'tradeGoods' }
  | { readonly kind: 'slot'; readonly name: SlotName }
  | { readonly kind: 'site'; readonly id: PlanetId }
  | { readonly kind: 'unit'; readonly id: UnitId }
  | { readonly kind: 'structure'; readonly type: UnitTypeId };

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

/** Der Weltraum des aktivierten Systems: Figuren, die nicht landen, bleiben hier. */
export const SPACE: TargetRef = { kind: 'slot', name: 'space' };

/** Ein Planet als Ziel für Figuren und Gebäude (anders als `planet:` beim Bezahlen). */
export const siteTarget = (id: PlanetId | string): TargetRef => ({
  kind: 'site',
  id: planetId(id),
});

/** Eine Figur auf dem Tisch (Schiff oder Bodentruppe). */
export const unitTarget = (id: UnitId | string): TargetRef => ({ kind: 'unit', id: unitId(id) });

/** Ein Gebäude einer Art aus dem Bauvorrat. */
export const structureTarget = (type: UnitTypeId | string): TargetRef => ({
  kind: 'structure',
  type: unitTypeId(type),
});

/** Der Teil hinter dem Doppelpunkt. */
function partOf(ref: TargetRef): string {
  switch (ref.kind) {
    case 'pool':
      return ref.pool;
    case 'goods':
      return ref.good;
    case 'slot':
      return ref.name;
    case 'structure':
      return ref.type;
    default:
      return ref.id;
  }
}

export const targetKey = (ref: TargetRef): string => `${ref.kind}:${partOf(ref)}`;

const isZone = (value: string): value is DraftZone =>
  (DRAFT_ZONES as readonly string[]).includes(value);

const SLOTS: ReadonlyMap<string, TargetRef> = new Map([
  ['kasse', KASSE],
  ['space', SPACE],
]);

const slotOf = (value: string): TargetRef | null => SLOTS.get(value) ?? null;

/** Je Art die Rückübersetzung des Werts; Unbekanntes ergibt `null`. */
const PARSERS: ReadonlyMap<string, (value: string) => TargetRef | null> = new Map([
  ['system', systemTarget],
  ['pool', (value: string) => (isZone(value) ? poolTarget(value) : null)],
  ['planet', planetTarget],
  ['card', cardTarget],
  ['goods', (value: string) => (value === 'tradeGoods' ? GOODS_PIECE : null)],
  ['slot', slotOf],
  ['site', siteTarget],
  ['unit', unitTarget],
  ['structure', structureTarget],
]);

/** Liest einen Schlüssel zurück; Unbekanntes ergibt `null`. */
export function parseTargetKey(key: string): TargetRef | null {
  const split = key.indexOf(':');
  const value = key.slice(split + 1);
  if (split < 0 || value === '') return null;
  return PARSERS.get(key.slice(0, split))?.(value) ?? null;
}

type Labeler = (ref: TargetRef, game: GameState, language: Language) => string;

type LabelsByKind = {
  readonly [K in TargetRef['kind']]: (
    ref: Extract<TargetRef, { readonly kind: K }>,
    game: GameState,
    language: Language,
  ) => string;
};

/** Name einer Figur: die Einheit ihrer Art, wo immer sie auf dem Spielplan steht. */
const unitName = (id: UnitId, game: GameState, language: Language): string => {
  const type = locateUnit(game, id)?.unit.type;
  return type === undefined ? id : unitLabel(type, language);
};

const LABELS: LabelsByKind = {
  system: (ref, game, language) => systemLabel(game, ref.id, language),
  planet: (ref, _game, language) => planetLabel(ref.id, language),
  site: (ref, _game, language) => planetLabel(ref.id, language),
  card: (ref, _game, language) => objectiveLabel(ref.id, language),
  unit: (ref, game, language) => unitName(ref.id, game, language),
  structure: (ref, _game, language) => unitLabel(ref.type, language),
  goods: (_ref, _game, language) => translate(language, 'tradeGoods'),
  slot: (ref, _game, language) => translate(language, ref.name === 'space' ? 'spaceSlot' : 'kasse'),
  pool: (ref, _game, language) =>
    translate(language, ref.pool === 'loose' ? 'looseTokens' : ref.pool),
};

/** Name eines Ziels für Ansagen: Leiste, Schale, System, Planet, Auftrag, Figur, Gebäude, Ablage. */
export const targetLabel = (ref: TargetRef, game: GameState, language: Language): string =>
  (LABELS[ref.kind] as Labeler)(ref, game, language);

/** Münzen: der Stapel Handelswaren und die Kasse (nicht der Weltraum, der auch eine Ablage ist). */
export const isCoinRef = (ref: TargetRef): boolean =>
  ref.kind === 'goods' || (ref.kind === 'slot' && ref.name === 'kasse');

/** Name eines getragenen Stücks: Münzen heißen Handelsware, ob vom Haufen oder aus der Kasse. */
export function pieceLabel(ref: TargetRef, game: GameState, language: Language): string {
  if (isCoinRef(ref)) return translate(language, 'tradeGood');
  return targetLabel(ref, game, language);
}
