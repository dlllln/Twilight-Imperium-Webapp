import type { ReducerMap } from '../eventsourcing/domain-event.ts';
import { type GameState, updatePlayer } from '../game/game-state.ts';
import type { PlanetState } from '../planet/planet-state.ts';
import type { PlanetId, PlayerId } from '../shared/ids.ts';
import type { ExplorationDeckKind, FragmentKind } from './exploration-definition.ts';
import type {
  AttachmentAdded,
  ExplorationEvent,
  RelicDrawn,
  RelicUsed,
  TradeGoodsCacheCollected,
} from './exploration-events.ts';
import type { ExplorationState } from './exploration-state.ts';

const withExploration = (
  state: GameState,
  change: (exploration: ExplorationState) => ExplorationState,
): GameState => ({ ...state, exploration: change(state.exploration) });

/** Die oberste Karte verlässt den Stapel; welche es ist, steht im Event (Replay ohne Stapel). */
const drawFrom = (state: GameState, deck: ExplorationDeckKind): GameState =>
  withExploration(state, (e) => ({ ...e, decks: { ...e.decks, [deck]: e.decks[deck].slice(1) } }));

function updatePlanet(state: GameState, id: PlanetId, change: (p: PlanetState) => PlanetState) {
  const planet = state.planets[id];
  return planet === undefined
    ? state
    : { ...state, planets: { ...state.planets, [id]: change(planet) } };
}

const attach = (state: GameState, event: AttachmentAdded): GameState =>
  updatePlanet(state, event.planet, (planet) => ({
    ...planet,
    attachments: [...(planet.attachments ?? []), event.attachment],
  }));

/** Entfernt je genanntem Fragment genau eines derselben Art. */
export function withoutFragments(
  held: readonly FragmentKind[],
  purged: readonly FragmentKind[],
): readonly FragmentKind[] {
  const remaining = [...held];
  for (const fragment of purged) {
    const index = remaining.indexOf(fragment);
    if (index >= 0) remaining.splice(index, 1);
  }
  return remaining;
}

function relicDrawn(state: GameState, event: RelicDrawn): GameState {
  const drawn = withExploration(state, (e) => ({ ...e, relicDeck: e.relicDeck.slice(1) }));
  return updatePlayer(drawn, event.player, (player) => ({
    ...player,
    relics: [...player.relics, { id: event.relic, exhausted: false }],
  }));
}

const relicUsed = (state: GameState, event: RelicUsed): GameState =>
  updatePlayer(state, event.player, (player) => ({
    ...player,
    relics: event.purged
      ? player.relics.filter((relic) => relic.id !== event.relic)
      : player.relics.map((relic) =>
          relic.id === event.relic ? { ...relic, exhausted: true } : relic,
        ),
  }));

function cacheCollected(state: GameState, event: TradeGoodsCacheCollected): GameState {
  const caches = Object.fromEntries(
    Object.entries(state.exploration.caches).filter(([system]) => system !== event.system),
  );
  return gainTradeGoods(
    withExploration(state, (e) => ({ ...e, caches })),
    event.player,
    event.amount,
  );
}

const gainTradeGoods = (state: GameState, player: PlayerId, amount: number) =>
  updatePlayer(state, player, (p) => ({ ...p, tradeGoods: p.tradeGoods + amount }));

/** PoK Statusphase: Relikte und legendäre Marker werden wieder bereit. */
export const readyExploration = (state: GameState): GameState => ({
  ...withExploration(state, (e) => ({ ...e, exhaustedLegendaries: [] })),
  players: state.players.map((player) => ({
    ...player,
    relics: player.relics.map((relic) => ({ ...relic, exhausted: false })),
  })),
});

export const explorationReducers: ReducerMap<GameState, ExplorationEvent> = {
  ExplorationPrepared: (state, event) =>
    withExploration(state, (e) => ({
      ...e,
      decks: event.decks,
      relicDeck: event.relicDeck,
      frontierTokens: event.frontierTokens,
    })),
  ExplorationDeckReshuffled: (state, event) =>
    withExploration(state, (e) => ({
      ...e,
      decks: { ...e.decks, [event.deck]: event.cards },
      discards: { ...e.discards, [event.deck]: [] },
    })),
  PlanetExplored: (state, event) => drawFrom(state, event.deck),
  FrontierExplored: (state, event) =>
    withExploration(drawFrom(state, 'frontier'), (e) => ({
      ...e,
      frontierTokens: e.frontierTokens.filter((system) => system !== event.system),
    })),
  ExplorationCardDiscarded: (state, event) =>
    withExploration(state, (e) => ({
      ...e,
      discards: { ...e.discards, [event.deck]: [...e.discards[event.deck], event.card] },
    })),
  AttachmentAdded: attach,
  RelicFragmentGained: (state, event) =>
    updatePlayer(state, event.player, (player) => ({
      ...player,
      relicFragments: [...player.relicFragments, event.fragment],
    })),
  TradeGoodsCachePlaced: (state, event) =>
    withExploration(state, (e) => ({
      ...e,
      caches: { ...e.caches, [event.system]: (e.caches[event.system] ?? 0) + event.amount },
    })),
  TradeGoodsCacheCollected: cacheCollected,
  CommoditiesGained: (state, event) =>
    updatePlayer(state, event.player, (p) => ({ ...p, commodities: p.commodities + event.amount })),
  RelicFragmentsPurged: (state, event) =>
    updatePlayer(state, event.player, (player) => ({
      ...player,
      relicFragments: withoutFragments(player.relicFragments, event.fragments),
    })),
  RelicDrawn: relicDrawn,
  RelicUsed: relicUsed,
  LegendaryAbilityUsed: (state, event) =>
    withExploration(state, (e) => ({
      ...e,
      exhaustedLegendaries: [...e.exhaustedLegendaries, event.planet],
    })),
};
