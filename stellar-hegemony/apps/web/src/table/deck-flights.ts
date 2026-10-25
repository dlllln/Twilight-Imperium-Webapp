import type { PlayerId } from '@stellar/domain';
import type { TabletopMove } from '../components/tabletop/tabletop-model.ts';

/*
 * Karten, die vom Stapel in die eigene Hand fliegen (rein): Aus den Bewegungen eines Zugs
 * werden die eigenen Ziehungen; wo sie starten (Stapel im Vorrat) und landen (Hand bzw.
 * Auftragsleiste), steht in Tabellen. Gezeichnet wird nur, was der Betrachter selbst zieht.
 */

export type FlightItem = 'action' | 'secret' | 'relic';

export interface DeckFlight {
  readonly item: FlightItem;
  /** Höchstens drei Karten fliegen sichtbar, die übrigen zählt die Ablage des Vorrats. */
  readonly cards: number;
}

/** So viele Karten fliegen je Ziehung höchstens. */
export const MAX_FLYING = 3;

/** Der Stapel im Vorrat, von dem die Karte kommt; eingeklappt der Schalter des Vorrats. */
export const FLIGHT_SOURCES: Readonly<Record<FlightItem, readonly string[]>> = {
  action: ['[data-pile="action"]', '.tabletop-supply'],
  secret: ['[data-pile="secret"]', '.tabletop-supply'],
  relic: ['[data-pile="relic"]', '.tabletop-supply'],
};

/** Wo sie landet: Aktionskarten und Relikte in der Hand, geheime Aufträge auf der Leiste. */
export const FLIGHT_TARGETS: Readonly<Record<FlightItem, readonly string[]>> = {
  action: ['.hand-dock'],
  secret: ['.objective-strip', '.hand-dock'],
  relic: ['.hand-dock'],
};

const FLYING: ReadonlySet<string> = new Set<FlightItem>(['action', 'secret', 'relic']);

const isFlightItem = (item: string): item is FlightItem => FLYING.has(item);

/** Die eigenen Ziehungen eines Zugs als Flüge; fremde Hände bleiben verdeckt am Tisch. */
export function deckFlights(
  moves: readonly TabletopMove[],
  viewer: PlayerId | null,
): readonly DeckFlight[] {
  if (viewer === null) return [];
  return moves.flatMap((move) =>
    move.kind === 'draw' && move.player === viewer && isFlightItem(move.item)
      ? [{ item: move.item, cards: Math.min(MAX_FLYING, move.count) }]
      : [],
  );
}

export interface Point {
  readonly x: number;
  readonly y: number;
}

interface Box {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

/** Mitte eines Rechtecks; ein leeres (verstecktes) Rechteck zählt nicht. */
export function centerOf(box: Box | null): Point | null {
  if (box === null || box.width === 0 || box.height === 0) return null;
  return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
}

/** Das erste sichtbare Element einer Liste von Selektoren. */
export function firstVisible(
  selectors: readonly string[],
  doc: ParentNode = document,
): Point | null {
  for (const selector of selectors) {
    const point = centerOf(doc.querySelector(selector)?.getBoundingClientRect() ?? null);
    if (point !== null) return point;
  }
  return null;
}
