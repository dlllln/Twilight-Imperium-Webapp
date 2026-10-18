import { currentActor, type GameEvent, type GameState, type PlayerId } from '@stellar/domain';

export type SoundCue =
  | 'activate'
  | 'move'
  | 'dice'
  | 'explosion'
  | 'capture'
  | 'produce'
  | 'token'
  | 'resource'
  | 'card'
  | 'research'
  | 'score'
  | 'vote'
  | 'phase'
  | 'yourTurn'
  | 'victory';

/** Welches Ereignis welchen Klang auslöst (Daten statt Verzweigungen). */
const CUES: Readonly<Partial<Record<GameEvent['type'], SoundCue>>> = {
  SystemActivated: 'activate',
  ShipsMoved: 'move',
  SpaceCannonFired: 'dice',
  SpaceCannonDefenseFired: 'dice',
  AntiFighterBarrageFired: 'dice',
  CombatRoundRolled: 'dice',
  BombardmentRolled: 'dice',
  GroundCombatRoundRolled: 'dice',
  UnitsDestroyed: 'explosion',
  PlanetControlGained: 'capture',
  UnitsProduced: 'produce',
  UnitsDeployed: 'produce',
  StrategyCardPicked: 'card',
  ActionCardsDrawn: 'card',
  ActionCardsDiscarded: 'card',
  ActionDeckReshuffled: 'card',
  SecretObjectiveDrawn: 'card',
  SecretObjectivesDealt: 'card',
  SecretObjectivesKept: 'card',
  AgendaRevealed: 'card',
  PublicObjectiveRevealed: 'card',
  ActionCardPlayed: 'card',
  PlanetExplored: 'card',
  FrontierExplored: 'card',
  RelicDrawn: 'research',
  RelicUsed: 'card',
  LegendaryAbilityUsed: 'card',
  LeaderUsed: 'card',
  LeaderUnlocked: 'research',
  TradeGoodsCacheCollected: 'resource',
  TradeGoodsSpent: 'resource',
  TradeGoodsGained: 'resource',
  CommoditiesGained: 'resource',
  CommoditiesReplenished: 'resource',
  PlanetsExhausted: 'card',
  PlanetsReadied: 'card',
  CommandTokensGained: 'token',
  CommandTokensLost: 'token',
  CommandTokensPlaced: 'token',
  CommandTokenReturned: 'token',
  CommandTokensRedistributed: 'token',
  CommandTokensAllocated: 'token',
  CommandTokensCleared: 'token',
  TechnologyResearched: 'research',
  ObjectiveScored: 'score',
  VictoryPointsGained: 'score',
  VotesCast: 'vote',
  StrategyPhaseStarted: 'phase',
  ActionPhaseStarted: 'phase',
  StatusPhaseStarted: 'phase',
  AgendaPhaseStarted: 'phase',
  GameWon: 'victory',
};

/** Höchstens so viele Klänge je Zug, sonst wird ein großer Zug zur Kakophonie. */
export const MAX_CUES = 4;

/** Klänge eines Zugs in Reihenfolge, jeder höchstens einmal; der Sieg übertönt alles. */
export function soundCues(events: readonly GameEvent[]): readonly SoundCue[] {
  const cues = [...new Set(events.flatMap((event) => CUES[event.type] ?? []))];
  return cues.includes('victory') ? ['victory'] : cues.slice(0, MAX_CUES);
}

/** Online: ein Signal, sobald man selbst wieder entscheiden muss. */
export function turnCue(before: GameState, after: GameState, me: PlayerId | null): SoundCue | null {
  if (me === null) return null;
  const now = currentActor(after);
  return now === me && currentActor(before) !== me ? 'yourTurn' : null;
}
