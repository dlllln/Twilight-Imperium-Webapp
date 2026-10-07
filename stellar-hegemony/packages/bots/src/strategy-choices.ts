import {
  homeSystemIdOf,
  NO_PAYMENT,
  ownPlanets,
  type StrategyCardDefinition,
  type StrategyChoice,
  type StrategyMechanic,
  isStructure,
  hasCapability,
} from '@stellar/domain';
import { type BotView, contentOf, me } from './bot-view.ts';
import { planPayment } from './payment-planner.ts';
import { researchable } from './research-planner.ts';
import { gainSplit } from './status-planner.ts';
import { scoringChoices } from './imperial-choices.ts';

type ChoicePlanner = (view: BotView, card: StrategyCardDefinition) => readonly StrategyChoice[];

const exhaustedOwn = (view: BotView) =>
  ownPlanets(view.state, view.player, contentOf(view))
    .filter((planet) => planet.state.exhausted)
    .map((planet) => planet.state.id);

function commandTokens(view: BotView, card: StrategyCardDefinition): readonly StrategyChoice[] {
  const player = me(view);
  const gained = Math.min(card.parameters['tokensGained'] ?? 0, player.reinforcementTokens);
  const split = gainSplit(player.commandPools, gained);
  return [split, { tactic: gained, fleet: 0, strategy: 0 }].map((allocation) => ({
    mechanic: 'commandTokens',
    influence: NO_PAYMENT,
    allocation,
  }));
}

/** Diplomatie: das Heimatsystem zuerst, sonst jedes System mit eigenem Planeten (RR 21.2). */
function diplomacy(view: BotView): readonly StrategyChoice[] {
  const home = homeSystemIdOf(view.state, view.player, contentOf(view));
  const own = Object.values(view.state.systems)
    .filter((system) =>
      system.planetIds.some((id) => view.state.planets[id]?.controller === view.player),
    )
    .map((system) => system.id)
    .sort((a, b) => Number(b === home) - Number(a === home));
  const planets = exhaustedOwn(view).slice(0, 2);
  return [...own, null].map((system) => ({ mechanic: 'diplomacy', system, planets }));
}

/** Bauen: je eigener Planet erst ein Dock, dann ein Gebäude mit Weltraumkanone. */
function construction(view: BotView): readonly StrategyChoice[] {
  const structures = contentOf(view).units.all(view.player).filter(isStructure);
  const docks = structures.filter((unit) => hasCapability(unit, 'production'));
  const cannons = structures.filter((unit) => hasCapability(unit, 'spaceCannon'));
  const planets = [...ownPlanets(view.state, view.player, contentOf(view))]
    .sort((a, b) => b.definition.resources - a.definition.resources)
    .map((planet) => planet.state.id);
  const builds = [...docks, ...cannons].flatMap((unit) =>
    planets.map((planet) => ({
      mechanic: 'construction' as const,
      placements: [{ type: unit.id, planet }],
      system: null,
    })),
  );
  return [...builds, { mechanic: 'construction', placements: [], system: null }];
}

function warfare(view: BotView): readonly StrategyChoice[] {
  const pools = me(view).commandPools;
  const marked = Object.values(view.state.systems).filter((system) =>
    system.commandTokens.includes(view.player),
  );
  const returned = marked.map((system) => ({
    mechanic: 'warfare' as const,
    system: system.id,
    pools: { ...pools, tactic: pools.tactic + 1 },
    production: null,
  }));
  return [...returned, { mechanic: 'warfare', system: null, pools, production: null }];
}

function technology(view: BotView): readonly StrategyChoice[] {
  const options = researchable(view).map((technology) => ({
    mechanic: 'technology' as const,
    technologies: [technology.id],
    specialties: [],
    payment: NO_PAYMENT,
  }));
  return [
    ...options,
    { mechanic: 'technology', technologies: [], specialties: [], payment: NO_PAYMENT },
  ];
}

function politics(view: BotView): readonly StrategyChoice[] {
  const others = view.state.players.filter((player) => player.id !== view.state.speaker);
  const self = others.find((player) => player.id === view.player);
  const ordered = self === undefined ? others : [self, ...others.filter((p) => p !== self)];
  return ordered.map((player) => ({ mechanic: 'politics', speaker: player.id }));
}

const PRIMARY: Readonly<Record<StrategyMechanic, ChoicePlanner>> = {
  commandTokens,
  diplomacy,
  construction,
  trade: () => [{ mechanic: 'trade', freeFor: [] }],
  warfare,
  technology,
  imperial: (view) => scoringChoices(view),
  politics,
};

/** Primärfähigkeit: gültige Auswahlen in der Reihenfolge, die dem Bot am meisten bringt. */
export const primaryChoices: ChoicePlanner = (view, card) => PRIMARY[card.mechanic](view, card);

/** Sekundärfähigkeit für Forschung: eine Technologie gegen Ressourcen. */
function researchSecondary(view: BotView, card: StrategyCardDefinition) {
  const cost = card.parameters['secondaryResearchCost'] ?? 0;
  const payment = planPayment(view, 'resources', cost);
  if (payment === null) return [];
  return researchable(view).map((technology) => ({
    mechanic: 'technology' as const,
    technologies: [technology.id],
    specialties: [],
    payment,
  }));
}

const SECONDARY: Partial<Readonly<Record<StrategyMechanic, ChoicePlanner>>> = {
  trade: () => [{ mechanic: 'trade', freeFor: [] }],
  imperial: () => [{ mechanic: 'imperial', objective: null, payment: NO_PAYMENT }],
  politics: () => [{ mechanic: 'politics', speaker: null }],
  diplomacy: (view) =>
    exhaustedOwn(view).length > 0
      ? [{ mechanic: 'diplomacy', system: null, planets: exhaustedOwn(view).slice(0, 2) }]
      : [],
  technology: researchSecondary,
};

/** Sekundärfähigkeiten, die sich für einen Bot lohnen; die übrigen lehnt er ab. */
export const secondaryChoices: ChoicePlanner = (view, card) =>
  SECONDARY[card.mechanic]?.(view, card) ?? [];
