import {
  clockwiseFrom,
  type ContentPort,
  currentPlanetDefinition,
  findPlayer,
  type GameState,
  ownedTechnologies,
  type PlanetId,
  type PlayerId,
  type PoolCounts,
  strategyCardsOf,
  type TechnologyColor,
} from '@stellar/domain';
import { interrupted } from '../hand/turn-guards.ts';

/*
 * Daten für die Anzeigen über der Karte (reine Funktionen): die Leiste mit den eigenen
 * Ressourcen oben und die Spielerporträts links.
 */

/** Bereit / gesamt, z. B. Ressourcen der eigenen Planeten. */
export interface Supply {
  readonly ready: number;
  readonly total: number;
}

export interface EmpireSummary {
  readonly resources: Supply;
  readonly influence: Supply;
  readonly tradeGoods: number;
  readonly commodities: Supply;
  readonly pools: PoolCounts;
  readonly technologies: Readonly<Record<TechnologyColor, number>>;
  readonly victoryPoints: number;
}

export const TECHNOLOGY_COLORS: readonly TechnologyColor[] = [
  'propulsion',
  'biotic',
  'cybernetic',
  'warfare',
];

type Currency = 'resources' | 'influence';

function supplyOf(game: GameState, player: PlayerId, content: ContentPort, currency: Currency) {
  const owned = Object.values(game.planets).filter((planet) => planet.controller === player);
  const value = (id: PlanetId) => currentPlanetDefinition(game, content.tiles, id)?.[currency] ?? 0;
  const sum = (ids: readonly PlanetId[]) => ids.reduce((total, id) => total + value(id), 0);
  return {
    ready: sum(owned.filter((planet) => !planet.exhausted).map((planet) => planet.id)),
    total: sum(owned.map((planet) => planet.id)),
  };
}

function technologyColors(game: GameState, player: PlayerId, content: ContentPort) {
  const owned = ownedTechnologies(game, player, content);
  const count = (color: TechnologyColor) => owned.filter((tech) => tech.color === color).length;
  return Object.fromEntries(TECHNOLOGY_COLORS.map((color) => [color, count(color)])) as Record<
    TechnologyColor,
    number
  >;
}

/** Alles, was die Ressourcenleiste oben für einen Spieler zeigt. */
export function empireSummary(
  game: GameState,
  player: PlayerId,
  content: ContentPort,
): EmpireSummary | null {
  const state = findPlayer(game, player);
  if (state === undefined) return null;
  return {
    resources: supplyOf(game, player, content, 'resources'),
    influence: supplyOf(game, player, content, 'influence'),
    tradeGoods: state.tradeGoods,
    commodities: { ready: state.commodities, total: state.commodityLimit },
    pools: state.commandPools,
    technologies: technologyColors(game, player, content),
    victoryPoints: state.victoryPoints,
  };
}

export interface RailEntry {
  readonly id: PlayerId;
  readonly initiatives: readonly number[];
  readonly active: boolean;
  readonly passed: boolean;
  readonly speaker: boolean;
}

/** Spieler in Zugreihenfolge (Aktionsphase) bzw. ab dem Sprecher, mit Initiative und Status. */
export function playerRail(game: GameState): readonly RailEntry[] {
  const order =
    game.actionPhase?.order ?? clockwiseFrom(game, game.speaker ?? game.host).map((p) => p.id);
  return order.map((id) => ({
    id,
    initiatives: strategyCardsOf(game, id).map((card) => card.initiative),
    active: game.actionPhase?.active === id,
    passed: game.actionPhase?.passed.includes(id) ?? false,
    speaker: game.speaker === id,
  }));
}

/** Der große Knopf unten rechts: Zug beenden nach der taktischen Aktion oder Passen. */
export type EndTurn =
  { readonly kind: 'endTactical'; readonly ready: boolean } | { readonly kind: 'pass' } | null;

/** Nur wer selbst am Zug ist und nicht unterbrochen wird, beendet ihn (nicht der Verteidiger). */
const ownTurn = (game: GameState, actor: PlayerId | null): actor is PlayerId =>
  actor !== null && game.actionPhase?.active === actor && !interrupted(game, actor);

export function endTurnOf(game: GameState, actor: PlayerId | null): EndTurn {
  const phase = game.actionPhase;
  if (game.phase !== 'action' || phase === null || !ownTurn(game, actor)) return null;
  if (phase.tactical != null) return { kind: 'endTactical', ready: phase.tactical.step === 'done' };
  const free = phase.secondary == null && phase.transaction == null;
  const unused = strategyCardsOf(game, actor).some((card) => !card.exhausted);
  return free && !unused ? { kind: 'pass' } : null;
}
