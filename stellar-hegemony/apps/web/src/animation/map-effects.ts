import type { GameEvent, GameState, Hex, PlanetId, PlayerId, SystemId } from '@stellar/domain';

/** Kurze Effekte auf der Karte; rein darstellend, ohne Einfluss auf das Spiel. */
export type MapEffect =
  | { readonly kind: 'travel'; readonly path: readonly Hex[]; readonly seat: number }
  | { readonly kind: 'pulse'; readonly at: Hex; readonly seat: number }
  | { readonly kind: 'blast'; readonly at: Hex }
  | { readonly kind: 'capture'; readonly at: Hex; readonly seat: number }
  | { readonly kind: 'arrive'; readonly at: Hex; readonly seat: number };

interface Lookup {
  readonly state: GameState;
  position(system: SystemId): Hex | null;
  seat(player: PlayerId): number;
}

const lookupIn = (state: GameState): Lookup => ({
  state,
  position: (system) => state.systems[system]?.position ?? null,
  seat: (player) => (state.players.find((p) => p.id === player)?.seat ?? 0) + 1,
});

const systemOfPlanet = (state: GameState, planet: PlanetId): SystemId | null =>
  Object.values(state.systems).find((system) => system.planetIds.includes(planet))?.id ?? null;

const at = (lookup: Lookup, system: SystemId | null): Hex[] => {
  const position = system === null ? null : lookup.position(system);
  return position === null ? [] : [position];
};

/** Jede eigene Route einmal: Schiffe auf demselben Weg fliegen gemeinsam. */
function travels(lookup: Lookup, event: Extract<GameEvent, { type: 'ShipsMoved' }>): MapEffect[] {
  const routes = new Map<string, readonly SystemId[]>();
  for (const movement of event.movements) {
    const route = [movement.from, ...movement.path];
    routes.set(route.join('>'), route);
  }
  const seat = lookup.seat(event.player);
  return [...routes.values()].map((route) => ({
    kind: 'travel',
    path: route.flatMap((system) => at(lookup, system)),
    seat,
  }));
}

type EffectRules = {
  readonly [K in GameEvent['type']]?: (
    lookup: Lookup,
    event: Extract<GameEvent, { type: K }>,
  ) => MapEffect[];
};

const RULES: EffectRules = {
  SystemActivated: (lookup, event) =>
    at(lookup, event.system).map((hex) => ({
      kind: 'pulse',
      at: hex,
      seat: lookup.seat(event.player),
    })),
  ShipsMoved: travels,
  UnitsDestroyed: (lookup, event) =>
    at(lookup, event.system).map((hex) => ({ kind: 'blast', at: hex })),
  PlanetControlGained: (lookup, event) =>
    at(lookup, systemOfPlanet(lookup.state, event.planet)).map((hex) => ({
      kind: 'capture',
      at: hex,
      seat: lookup.seat(event.player),
    })),
  UnitsProduced: (lookup, event) =>
    at(lookup, event.system).map((hex) => ({
      kind: 'arrive',
      at: hex,
      seat: lookup.seat(event.player),
    })),
};

/** Welche Effekte ein Zug auslöst; mehrere Explosionen im selben System zählen einmal. */
export function mapEffects(before: GameState, events: readonly GameEvent[]): readonly MapEffect[] {
  const lookup = lookupIn(before);
  const effects = events.flatMap((event) => {
    const rule = RULES[event.type] as ((l: Lookup, e: GameEvent) => MapEffect[]) | undefined;
    return rule === undefined ? [] : rule(lookup, event);
  });
  const seen = new Set<string>();
  return effects.filter((effect) => {
    const key = JSON.stringify(effect);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
