import {
  type ContentPort,
  findPlayer,
  type GameState,
  secondaryTokenCost,
  type StrategyCardId,
  type StrategyMechanic,
} from '@stellar/domain';
import { useSettingsStore } from '../settings-store.ts';
import { content } from '../store.ts';
import type { DecisionRoute } from './decision-route.ts';
import { useDecisionRoute } from './use-decision-route.ts';

/*
 * Der Sockel der Sekundärfähigkeit: Wer der Karte eines anderen folgt, legt dort einen Marker aus
 * dem Strategiefeld ab. Was das kostet, sagt allein die Domain (`secondaryTokenCost`); hier steht
 * nur, ob die Kosten erlassen sind (Freibrief, Fraktion) und ob der Marker vorhanden ist.
 */

export interface SecondarySocket {
  readonly card: StrategyCardId;
  readonly mechanic: StrategyMechanic;
  readonly cost: 0 | 1;
  /** Die Karte kostet sonst einen Marker, für diesen Spieler aber nicht. */
  readonly waived: boolean;
  /** Kostenlos oder mindestens ein Marker im Strategiefeld. */
  readonly affordable: boolean;
}

/** Der Sockel der offenen Sekundärfähigkeit; `null` bei jeder anderen Entscheidung. */
export function secondarySocket(
  game: GameState,
  route: DecisionRoute,
  port: ContentPort,
): SecondarySocket | null {
  const { actor } = route;
  const definition = port.strategyCards.find((card) => card.id === route.card);
  if (route.kind !== 'secondary' || actor === null || definition === undefined) return null;
  const cost = secondaryTokenCost(game, actor, definition);
  const tokens = findPlayer(game, actor)?.commandPools.strategy ?? 0;
  return {
    card: definition.id,
    mechanic: definition.mechanic,
    cost,
    waived: definition.secondaryCostsStrategyToken && cost === 0,
    affordable: cost === 0 || tokens > 0,
  };
}

/** Der Sockel am Bildschirm; die klassische Ansicht zeigt keinen. */
export function useSecondarySocket(game: GameState | null): SecondarySocket | null {
  const route = useDecisionRoute(game);
  const table = useSettingsStore((state) => state.tableView);
  if (!table || game === null || route === null) return null;
  return secondarySocket(game, route, content);
}
