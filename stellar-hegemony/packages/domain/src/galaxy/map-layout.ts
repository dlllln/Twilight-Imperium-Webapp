import type { Hex } from '../hex/hex-coordinate.ts';
import type { SystemId } from '../shared/ids.ts';

/** Inhalt eines Feldes beim Galaxie-Aufbau. */
export type SlotContent =
  { readonly kind: 'tile'; readonly tileId: SystemId } | { readonly kind: 'home' };

export interface MapSlot {
  readonly position: Hex;
  readonly content: SlotContent;
}

/** Eine Galaxie vor dem Spielstart: welche Tafel liegt wo, wo sind Heimat-Plätze. */
export type MapLayout = readonly MapSlot[];

/** Vorlage für eine Spielerzahl: wo Heimat-Systeme liegen und wie viele Tafeln verteilt werden. */
export interface GalaxyTemplate {
  readonly playerCount: number;
  /** In Sitzreihenfolge (im Uhrzeigersinn). */
  readonly homeSlots: readonly Hex[];
  /** Felder für ausgeteilte Tafeln (ohne Zentrum und Heimat-Plätze). */
  readonly systemSlots: readonly Hex[];
  readonly blueTiles: number;
  readonly redTiles: number;
}
