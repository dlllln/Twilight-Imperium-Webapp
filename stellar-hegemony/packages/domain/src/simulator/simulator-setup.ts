import type { ContentPort } from '../ports/content-port.ts';
import type { FactionId, PlayerId } from '../shared/ids.ts';
import { type ModifierSource, TechnologyCatalog } from '../technology/technology-catalog.ts';
import type { UnitCatalog } from '../unit/unit-catalog.ts';
import { type FleetOrder, fleetUnits } from './fleet-order.ts';
import type { SimBattle, SimSide, TacticCard } from './simulator-state.ts';

/** Fähigkeiten und Starttechnologien einer Fraktion, soweit sie Einheitenwerte ändern. */
function sourcesOf(
  content: ContentPort,
  faction: FactionId | undefined,
): readonly ModifierSource[] {
  const definition = content.factions.find((candidate) => candidate.id === faction);
  if (definition === undefined) return [];
  const technologies = definition.startingTechnologies.flatMap(
    (id) => content.technologies.find((tech) => tech.id === id) ?? [],
  );
  return [...technologies, ...definition.abilities];
}

/** Einheitenwerte im Simulator: jede Seite mit den Stärken ihrer Fraktion (Decorator). */
export function simulatorCatalog(
  content: ContentPort,
  factions: Readonly<Partial<Record<PlayerId, FactionId>>>,
): UnitCatalog {
  return new TechnologyCatalog(content.units, (player) => sourcesOf(content, factions[player]));
}

export interface SideSetup {
  readonly player: PlayerId;
  readonly order: FleetOrder;
}

/** Abstand der Einheiten-Ids beider Seiten, damit sie nie zusammenfallen. */
const ID_BLOCK = 1000;

/** Neuer Kampf aus zwei gültigen Bestellungen; jede Seite bekommt alle Taktikkarten. */
export function startBattle(
  attacker: SideSetup,
  defender: SideSetup,
  cards: readonly TacticCard[],
): SimBattle {
  const hand = cards.map((card) => card.id);
  const side = (setup: SideSetup, first: number): SimSide => ({
    player: setup.player,
    units: fleetUnits(setup.order, setup.player, first),
    hand,
  });
  return {
    attacker: side(attacker, 1),
    defender: side(defender, ID_BLOCK),
    round: 0,
    outcome: null,
  };
}
