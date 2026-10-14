import type { DomainEvent } from '../eventsourcing/domain-event.ts';
import type { PlanetAttachment } from '../planet/planet-state.ts';
import type { ExplorationCardId, PlanetId, PlayerId, RelicId, SystemId } from '../shared/ids.ts';
import type { ExplorationDeckKind, FragmentKind } from './exploration-definition.ts';
import type { ExplorationPiles } from './exploration-state.ts';

/** PoK Spielaufbau: Erkundungs- und Reliktstapel gemischt, Grenzmarker in leeren Systemen. */
export interface ExplorationPrepared extends DomainEvent<'ExplorationPrepared'> {
  readonly decks: ExplorationPiles;
  readonly relicDeck: readonly RelicId[];
  readonly frontierTokens: readonly SystemId[];
}

/** Ein leerer Erkundungsstapel wird aus seiner Ablage neu gemischt. */
export interface ExplorationDeckReshuffled extends DomainEvent<'ExplorationDeckReshuffled'> {
  readonly deck: ExplorationDeckKind;
  readonly cards: readonly ExplorationCardId[];
}

/** PoK Erkundung: oberste Karte des Stapels der Planeteneigenschaft, offen aufgedeckt. */
export interface PlanetExplored extends DomainEvent<'PlanetExplored'> {
  readonly player: PlayerId;
  readonly planet: PlanetId;
  readonly deck: ExplorationDeckKind;
  readonly card: ExplorationCardId;
}

/** PoK Grenzmarker: der Marker verschwindet, die oberste Grenzkarte wird aufgedeckt. */
export interface FrontierExplored extends DomainEvent<'FrontierExplored'> {
  readonly player: PlayerId;
  readonly system: SystemId;
  readonly card: ExplorationCardId;
}

/** Abgehandelte Karte ohne bleibende Wirkung kommt auf die Ablage ihres Stapels. */
export interface ExplorationCardDiscarded extends DomainEvent<'ExplorationCardDiscarded'> {
  readonly deck: ExplorationDeckKind;
  readonly card: ExplorationCardId;
}

export interface AttachmentAdded extends DomainEvent<'AttachmentAdded'> {
  readonly planet: PlanetId;
  readonly attachment: PlanetAttachment;
}

export interface RelicFragmentGained extends DomainEvent<'RelicFragmentGained'> {
  readonly player: PlayerId;
  readonly fragment: FragmentKind;
}

export interface TradeGoodsCachePlaced extends DomainEvent<'TradeGoodsCachePlaced'> {
  readonly system: SystemId;
  readonly amount: number;
}

/** Wer mit Schiffen in ein System mit Depot kommt, nimmt dessen Handelswaren. */
export interface TradeGoodsCacheCollected extends DomainEvent<'TradeGoodsCacheCollected'> {
  readonly player: PlayerId;
  readonly system: SystemId;
  readonly amount: number;
}

/** Rohstoffe aus einer Belohnung, schon auf das Rohstofflimit begrenzt. */
export interface CommoditiesGained extends DomainEvent<'CommoditiesGained'> {
  readonly player: PlayerId;
  readonly amount: number;
}

/** PoK Relikt: drei Fragmente einer Art kommen aus dem Spiel. */
export interface RelicFragmentsPurged extends DomainEvent<'RelicFragmentsPurged'> {
  readonly player: PlayerId;
  readonly fragments: readonly FragmentKind[];
}

/** Das oberste Relikt geht offen an den Spieler. */
export interface RelicDrawn extends DomainEvent<'RelicDrawn'> {
  readonly player: PlayerId;
  readonly relic: RelicId;
}

/** Komponentenaktion eines Relikts; `purged` heißt, es ist danach aus dem Spiel. */
export interface RelicUsed extends DomainEvent<'RelicUsed'> {
  readonly player: PlayerId;
  readonly relic: RelicId;
  readonly purged: boolean;
}

/** Legendäre Fähigkeit genutzt; ihr Marker ist bis zur Statusphase erschöpft. */
export interface LegendaryAbilityUsed extends DomainEvent<'LegendaryAbilityUsed'> {
  readonly player: PlayerId;
  readonly planet: PlanetId;
}

export type ExplorationEvent =
  | ExplorationPrepared
  | ExplorationDeckReshuffled
  | PlanetExplored
  | FrontierExplored
  | ExplorationCardDiscarded
  | AttachmentAdded
  | RelicFragmentGained
  | TradeGoodsCachePlaced
  | TradeGoodsCacheCollected
  | CommoditiesGained
  | RelicFragmentsPurged
  | RelicDrawn
  | RelicUsed
  | LegendaryAbilityUsed;
