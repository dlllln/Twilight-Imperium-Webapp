import {
  type ActionCardId,
  actionCardId,
  COMMAND_POOLS,
  type CommandPool,
  findPlayer,
  type GameState,
  locateUnit,
  type PlanetId,
  planetId,
  type PlayerId,
  playerId,
  type SystemId,
  systemId,
  type UnitId,
  unitId,
  type UnitTypeId,
  unitTypeId,
} from '@stellar/domain';
import { type Language, type MessageKey, translate } from '../i18n.ts';
import { outcomeLabel } from '../components/agenda/outcome-label.ts';
import { actionCardLabel, objectiveLabel, planetLabel, systemLabel, unitLabel } from '../labels.ts';

/*
 * Ziele und Stücke am Tisch als reine Daten: ein System oder Planet auf der Karte, ein Feld des
 * Pults, eine Auftragskarte, der Stapel Handelswaren, die Kasse, eine Figur, ein Gebäude aus dem
 * Bauvorrat oder der Weltraum des aktivierten Systems. Der Schlüssel („system:18“, „pool:loose“,
 * „planet:mecatol“) steht als `data-target` im DOM und kommt beim Ablegen zurück. Ein Planet als
 * Bezahlung heißt „planet:“, ein Planet als Ziel für Figuren und Gebäude „site:“. Dazu kommen
 * Menschen und Karten am Tisch: das Bild eines Mitspielers („player:“), der Sprechermarker
 * („speaker:token“) und eine Aktionskarte aus der Hand („action:“). Die Werft legt Einheiten
 * als Stücke aus („yard:infantry“) in ihr Dock („slot:dock“), die Handelsmatte nimmt Münzen und
 * Rohstoffkisten („goods:commodities“) auf. Auf der Kampfmatte wandern rote Trefferstifte
 * („peg:hit“) auf Schiffe („unit:“), auf dem Agendatisch sind die Ergebnisse Platten
 * („outcome:for“, „outcome:<Spieler>“, „outcome:<Planet>“).
 */

/** Die Felder einer Markerverteilung: die drei Leisten und die Schale „Neue Marker“. */
export type DraftZone = CommandPool | 'loose';

/**
 * Ablagen ohne eigene Kennung: die Kasse am Pult, der Weltraum des aktivierten Systems, der
 * Sockel der Sekundärfähigkeit in der Ansage und das Dock der Werft.
 */
export type SlotName = 'kasse' | 'space' | 'socket' | 'dock';

/** Waren am Pult: Handelswaren (Münzen) und Rohstoffe (Kisten). */
export type GoodKind = 'tradeGoods' | 'commodities';

export const DRAFT_ZONES: readonly DraftZone[] = ['loose', ...COMMAND_POOLS];

export type TargetRef =
  | { readonly kind: 'system'; readonly id: SystemId }
  | { readonly kind: 'pool'; readonly pool: DraftZone }
  | { readonly kind: 'planet'; readonly id: PlanetId }
  | { readonly kind: 'card'; readonly id: string }
  | { readonly kind: 'goods'; readonly good: GoodKind }
  | { readonly kind: 'slot'; readonly name: SlotName }
  | { readonly kind: 'site'; readonly id: PlanetId }
  | { readonly kind: 'unit'; readonly id: UnitId }
  | { readonly kind: 'structure'; readonly type: UnitTypeId }
  | { readonly kind: 'player'; readonly id: PlayerId }
  | { readonly kind: 'speaker' }
  | { readonly kind: 'action'; readonly id: ActionCardId }
  | { readonly kind: 'yard'; readonly type: UnitTypeId }
  | { readonly kind: 'peg' }
  | { readonly kind: 'outcome'; readonly id: string };

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

/** Der eigene Stapel Rohstoffe: Kisten werden hier aufgenommen (nur für den Handel). */
export const CRATE_PIECE: TargetRef = { kind: 'goods', good: 'commodities' };

/** Die Kasse am Pult: Münzen, die in die laufende Bezahlung gehen. */
export const KASSE: TargetRef = { kind: 'slot', name: 'kasse' };

/** Der Weltraum des aktivierten Systems: Figuren, die nicht landen, bleiben hier. */
export const SPACE: TargetRef = { kind: 'slot', name: 'space' };

/** Der Sockel der Sekundärfähigkeit: Wer folgt, legt hier seinen Strategiemarker ab. */
export const SOCKET: TargetRef = { kind: 'slot', name: 'socket' };

/** Das Dock der Werft: Einheiten, die hier abgelegt werden, gehen in die Bestellung. */
export const DOCK: TargetRef = { kind: 'slot', name: 'dock' };

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

/** Das Bild eines Mitspielers auf der Spielerleiste. */
export const playerTarget = (id: PlayerId | string): TargetRef => ({
  kind: 'player',
  id: playerId(id),
});

/** Der Sprechermarker (Messing), den die Politik weiterreicht. */
export const SPEAKER_PIECE: TargetRef = { kind: 'speaker' };

/** Eine Aktionskarte aus der eigenen Hand als Stück, das auf ein Ziel gelegt wird. */
export const actionPiece = (id: ActionCardId | string): TargetRef => ({
  kind: 'action',
  id: actionCardId(id),
});

/** Eine Einheit einer Art aus der Werft (Bestellung, nicht eine Figur auf dem Plan). */
export const yardPiece = (type: UnitTypeId | string): TargetRef => ({
  kind: 'yard',
  type: unitTypeId(type),
});

/** Ein roter Trefferstift der Kampfmatte; alle Stifte sind gleich, es gibt nur einen Stapel. */
export const HIT_PEG: TargetRef = { kind: 'peg' };

/** Eine Ergebnisplatte des Agendatisches: Dafür, Dagegen, ein Spieler oder ein Planet. */
export const outcomeTarget = (id: string): TargetRef => ({ kind: 'outcome', id });

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
    case 'yard':
      return ref.type;
    case 'speaker':
      return 'token';
    case 'peg':
      return 'hit';
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
  ['socket', SOCKET],
  ['dock', DOCK],
]);

const slotOf = (value: string): TargetRef | null => SLOTS.get(value) ?? null;

const GOODS: ReadonlyMap<string, TargetRef> = new Map([
  ['tradeGoods', GOODS_PIECE],
  ['commodities', CRATE_PIECE],
]);

const goodsOf = (value: string): TargetRef | null => GOODS.get(value) ?? null;

const speakerOf = (value: string): TargetRef | null => (value === 'token' ? SPEAKER_PIECE : null);

const pegOf = (value: string): TargetRef | null => (value === 'hit' ? HIT_PEG : null);

/** Je Art die Rückübersetzung des Werts; Unbekanntes ergibt `null`. */
const PARSERS: ReadonlyMap<string, (value: string) => TargetRef | null> = new Map([
  ['system', systemTarget],
  ['pool', (value: string) => (isZone(value) ? poolTarget(value) : null)],
  ['planet', planetTarget],
  ['card', cardTarget],
  ['goods', goodsOf],
  ['slot', slotOf],
  ['site', siteTarget],
  ['unit', unitTarget],
  ['structure', structureTarget],
  ['player', playerTarget],
  ['speaker', speakerOf],
  ['action', actionPiece],
  ['yard', yardPiece],
  ['peg', pegOf],
  ['outcome', outcomeTarget],
]);

/** Liest einen Schlüssel zurück; Unbekanntes ergibt `null`. */
export function parseTargetKey(key: string): TargetRef | null {
  const split = key.indexOf(':');
  const value = key.slice(split + 1);
  if (split < 0 || value === '') return null;
  return PARSERS.get(key.slice(0, split))?.(value) ?? null;
}

const SLOT_LABELS: Readonly<Record<SlotName, MessageKey>> = {
  kasse: 'kasse',
  space: 'spaceSlot',
  socket: 'secondarySocket',
  dock: 'shipyardDock',
};

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
  goods: (ref, _game, language) => translate(language, ref.good),
  slot: (ref, _game, language) => translate(language, SLOT_LABELS[ref.name]),
  pool: (ref, _game, language) =>
    translate(language, ref.pool === 'loose' ? 'looseTokens' : ref.pool),
  player: (ref, game) => findPlayer(game, ref.id)?.name ?? ref.id,
  speaker: (_ref, _game, language) => translate(language, 'speakerToken'),
  action: (ref, _game, language) => actionCardLabel(ref.id, language),
  yard: (ref, _game, language) => unitLabel(ref.type, language),
  peg: (_ref, _game, language) => translate(language, 'hitPeg'),
  outcome: (ref, game, language) =>
    outcomeLabel(game, ref.id, language, (key) => translate(language, key)),
};

/** Name eines Ziels für Ansagen: Leiste, System, Planet, Auftrag, Figur, Mitspieler, Karte … */
export const targetLabel = (ref: TargetRef, game: GameState, language: Language): string =>
  (LABELS[ref.kind] as Labeler)(ref, game, language);

/**
 * Münzen: der Stapel Handelswaren und die Kasse (nicht der Weltraum, der auch eine Ablage ist,
 * und nicht die Rohstoffkisten, die nicht bezahlen).
 */
export const isCoinRef = (ref: TargetRef): boolean =>
  (ref.kind === 'goods' && ref.good === 'tradeGoods') ||
  (ref.kind === 'slot' && ref.name === 'kasse');

/** Eine Rohstoffkiste vom eigenen Stapel. */
export const isCrateRef = (ref: TargetRef): boolean =>
  ref.kind === 'goods' && ref.good === 'commodities';

/**
 * Name eines getragenen Stücks: Münzen heißen Handelsware, ob vom Haufen oder aus der Kasse,
 * Kisten Rohstoff.
 */
export function pieceLabel(ref: TargetRef, game: GameState, language: Language): string {
  if (isCoinRef(ref)) return translate(language, 'tradeGood');
  if (isCrateRef(ref)) return translate(language, 'commodity');
  return targetLabel(ref, game, language);
}
