import {
  type Currency,
  findPlayer,
  type GameState,
  type PlanetId,
  type PlayerId,
  spendablePlanets,
} from '@stellar/domain';
import type { MessageKey } from '../i18n.ts';
import { paymentValue } from '../payment-view.ts';
import { content } from '../store.ts';
import { planetTarget, targetKey, type TargetState } from './target-ref.ts';

/*
 * Was die Planetenreihe und die Planeten auf der Karte gerade anbieten (Typen und reiner Aufbau):
 * Bezahlen erschöpft vorgemerkte bereite Planeten, Bereitmachen richtet erschöpfte wieder auf.
 */

export type PlanetMode = 'pay' | 'ready';

/** Die Seite der Entscheidung: was angeboten, was gewählt ist und was es braucht. */
export interface PlanetSide {
  readonly mode: PlanetMode;
  /** Beim Bezahlen die Währung; beim Bereitmachen `null`. */
  readonly currency: Currency | null;
  readonly chosen: readonly PlanetId[];
  /** Planeten, die sich jetzt vormerken lassen (gewählte eingeschlossen). */
  readonly offered: readonly PlanetId[];
  /** Höchstzahl der wählbaren Planeten; `null` ohne Grenze. */
  readonly limit: number | null;
  /** Münzen in der Kasse; `null`, wenn keine Handelswaren mitzahlen. */
  readonly tradeGoods: number | null;
  /** Geforderter Betrag; `null`, wenn es keinen gibt (z. B. Führung). */
  readonly required: number | null;
}

export interface PlanetHandlers {
  readonly toggle: (planet: PlanetId) => void;
  readonly addCoins: (delta: 1 | -1) => void;
}

export interface PlanetTable extends PlanetSide, PlanetHandlers {
  readonly player: PlayerId;
  /** Wert je bezahlbarem Planeten in der Währung; beim Bereitmachen leer. */
  readonly values: ReadonlyMap<PlanetId, number>;
  /** Wert der Bezahlung laut Domain; beim Bereitmachen `null`. */
  readonly paid: number | null;
  readonly ownTradeGoods: number;
}

const isFull = (side: PlanetSide): boolean =>
  side.limit !== null && side.chosen.length >= side.limit;

/** Zielschlüssel `planet:<id>`: gewählte als 'chosen', weitere angebotene als 'legal'. */
export function planetStates(side: PlanetSide): ReadonlyMap<string, TargetState> {
  const states = new Map<string, TargetState>();
  const legal = isFull(side) ? [] : side.offered;
  for (const planet of legal) states.set(targetKey(planetTarget(planet)), 'legal');
  for (const planet of side.chosen) states.set(targetKey(planetTarget(planet)), 'chosen');
  return states;
}

function valuesOf(game: GameState, player: PlayerId, side: PlanetSide): Map<PlanetId, number> {
  if (side.currency === null) return new Map();
  const spendable = spendablePlanets(game, content.tiles, player, side.currency);
  return new Map(spendable.map((entry) => [entry.planet, entry.value]));
}

function paidOf(game: GameState, player: PlayerId, side: PlanetSide): number | null {
  if (side.mode !== 'pay' || side.currency === null) return null;
  const payment = { planets: side.chosen, tradeGoods: side.tradeGoods ?? 0 };
  return paymentValue(game, player, payment, content, side.currency);
}

export function planetTableOf(
  game: GameState,
  player: PlayerId,
  side: PlanetSide,
  handlers: PlanetHandlers,
): PlanetTable {
  return {
    ...side,
    ...handlers,
    player,
    values: valuesOf(game, player, side),
    paid: paidOf(game, player, side),
    ownTradeGoods: findPlayer(game, player)?.tradeGoods ?? 0,
  };
}

/** Ob die Kasse etwas zu tun hat: eigene Handelswaren oder schon Münzen darin. */
export const kasseUseful = (table: PlanetTable): boolean =>
  table.mode === 'pay' &&
  table.tradeGoods !== null &&
  (table.ownTradeGoods > 0 || table.tradeGoods > 0);

/** Hinweis, wo bezahlt wird; die Kasse nur, wenn Handelswaren mitzahlen können. */
export const payHintOf = (ownTradeGoods: number): MessageKey =>
  ownTradeGoods > 0 ? 'payOnTable' : 'payOnTablePlanets';
