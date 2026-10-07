import type { DecisionContext } from '../eventsourcing/command.ts';
import { findPlayer, type GameState } from '../game/game-state.ts';
import type { ContentPort } from '../ports/content-port.ts';
import type { PlayerId, UnitTypeId } from '../shared/ids.ts';
import type { UnitCatalog } from '../unit/unit-catalog.ts';
import type { UnitDefinition } from '../unit/unit-definition.ts';
import type { TechnologyDefinition, UnitModifier } from './technology-definition.ts';
import { applyChange, matches } from './unit-modifiers.ts';
import { factionRule } from '../faction/faction-ability.ts';

/** Technologien eines Spielers als Stammdaten, in der Reihenfolge des Erwerbs. */
export function ownedTechnologies(
  state: GameState,
  player: PlayerId,
  content: Pick<ContentPort, 'technologies'>,
): readonly TechnologyDefinition[] {
  const owned = findPlayer(state, player)?.technologies ?? [];
  return owned.flatMap((id) => content.technologies.find((tech) => tech.id === id) ?? []);
}

/** Alles, was Einheitenwerte eines Spielers ändert: Technologien und Fraktionsfähigkeiten. */
export interface ModifierSource {
  readonly upgrades?: UnitTypeId;
  readonly modifiers: readonly UnitModifier[];
}

/** Fähigkeiten der Fraktion eines Spielers (Iteration 11). */
export function factionAbilitiesOf(
  state: GameState,
  player: PlayerId,
  content: Pick<ContentPort, 'factions'>,
): readonly ModifierSource[] {
  const faction = findPlayer(state, player)?.faction;
  return content.factions.find((candidate) => candidate.id === faction)?.abilities ?? [];
}

/** Aufwertungen zuerst (sie ersetzen Werte), danach Boni (sie addieren). */
const upgradesFirst = (a: ModifierSource, b: ModifierSource) =>
  Number(a.upgrades === undefined) - Number(b.upgrades === undefined);

/**
 * Decorator um den Grundkatalog: Mit Besitzer liefert er dessen Werte nach allen
 * Technologien; ohne Besitzer die Grundwerte (Open/Closed, Liskov).
 */
export class TechnologyCatalog implements UnitCatalog {
  constructor(
    private readonly base: UnitCatalog,
    private readonly owned: (player: PlayerId) => readonly ModifierSource[],
  ) {}

  find(type: UnitTypeId, owner?: PlayerId): UnitDefinition | undefined {
    const definition = this.base.find(type);
    return definition === undefined || owner === undefined
      ? definition
      : this.improve(definition, owner);
  }

  all(owner?: PlayerId): readonly UnitDefinition[] {
    const all = this.base.all();
    return owner === undefined ? all : all.map((unit) => this.improve(unit, owner));
  }

  private improve(unit: UnitDefinition, owner: PlayerId): UnitDefinition {
    return [...this.owned(owner)]
      .sort(upgradesFirst)
      .flatMap((tech) => tech.modifiers)
      .filter((modifier) => matches(modifier.target, unit))
      .reduce((current, modifier) => applyChange(current, modifier.change), unit);
  }
}

/** Katalog mit den Technologien aller Spieler dieses Spielstands. */
export const technologyCatalog = (state: GameState, content: ContentPort): UnitCatalog =>
  new TechnologyCatalog(content.units, (player) => [
    ...ownedTechnologies(state, player, content),
    ...factionAbilitiesOf(state, player, content),
  ]);

/** Entscheidungskontext, in dem alle Einheitenwerte die Technologien berücksichtigen. */
export const withTechnologies = (context: DecisionContext, state: GameState): DecisionContext => ({
  ...context,
  content: { ...context.content, units: technologyCatalog(state, context.content) },
});

/** Flottenlimit: Marker im Flottenpool plus Boni aus Technologien und Fraktion (RR 28). */
export function fleetLimitOf(state: GameState, player: PlayerId, content: ContentPort): number {
  const pool = findPlayer(state, player)?.commandPools.fleet ?? 0;
  const bonus = ownedTechnologies(state, player, content).reduce(
    (sum, tech) => sum + (tech.rules?.fleetLimit ?? 0),
    0,
  );
  return pool + bonus + factionRule(state, player, 'fleetLimit');
}
