import type { ReducerMap } from '../eventsourcing/domain-event.ts';
import { type GameState, updatePlayer } from '../game/game-state.ts';
import type { PlayerState } from '../player/player-state.ts';
import type { ObjectiveId, PlayerId } from '../shared/ids.ts';
import type { ObjectiveCategory } from './objective-definition.ts';
import type { StatusPhaseState } from './objective-state.ts';
import type { ObjectiveEvent, ObjectiveScored, SecretObjectiveDrawn } from './objective-events.ts';

export const scoredBy = (state: GameState, objective: string): readonly PlayerId[] =>
  state.objectives.scored[objective] ?? [];

/** RR 68.5: höchstens so viele Siegpunkte wie zum Sieg nötig. */
const addPoints = (state: GameState, player: PlayerId, points: number): GameState =>
  updatePlayer(state, player, (p) => ({
    ...p,
    victoryPoints: Math.min(state.config.victoryPointsToWin, p.victoryPoints + points),
  }));

/** RR 12.6: In der Statusphase wird je Spieler vermerkt, welche Art er schon gewertet hat. */
function markStatus(state: GameState, event: ObjectiveScored): StatusPhaseState | null {
  const status = state.statusPhase;
  if (status === null) return null;
  const category: ObjectiveCategory = state.objectives.public.some(
    (slot) => slot.id === event.objective,
  )
    ? 'public'
    : 'secret';
  const before = status.scored[event.player] ?? [];
  return { ...status, scored: { ...status.scored, [event.player]: [...before, category] } };
}

function score(state: GameState, event: ObjectiveScored): GameState {
  const scored = {
    ...state.objectives.scored,
    [event.objective]: [...scoredBy(state, event.objective), event.player],
  };
  const statusPhase = markStatus(state, event);
  const next = { ...state, statusPhase, objectives: { ...state.objectives, scored } };
  return addPoints(next, event.player, event.points);
}

/** Über dem Limit (RR 37.4): alle nicht gewerteten Karten gehen in eine neue Auswahl. */
function holdDrawn(
  state: GameState,
  player: PlayerState,
  event: SecretObjectiveDrawn,
): PlayerState {
  if (!event.overLimit)
    return { ...player, secretObjectives: [...player.secretObjectives, event.objective] };
  const isScored = (id: ObjectiveId) => scoredBy(state, id).includes(player.id);
  const open = player.secretObjectives.filter((id) => !isScored(id));
  return {
    ...player,
    secretObjectives: player.secretObjectives.filter(isScored),
    secretChoice: { options: [...open, event.objective], keep: open.length },
  };
}

function draw(state: GameState, event: SecretObjectiveDrawn): GameState {
  const secretDeck = state.objectives.secretDeck.filter((id) => id !== event.objective);
  const next = { ...state, objectives: { ...state.objectives, secretDeck } };
  return updatePlayer(next, event.player, (player) => holdDrawn(state, player, event));
}

export const objectiveReducers: ReducerMap<GameState, ObjectiveEvent> = {
  ObjectivesPrepared: (state, event) => ({
    ...state,
    objectives: { public: event.public, secretDeck: event.secretDeck, scored: {} },
  }),
  PublicObjectiveRevealed: (state, event) => ({
    ...state,
    objectives: {
      ...state.objectives,
      public: state.objectives.public.map((slot) =>
        slot.id === event.objective ? { ...slot, revealed: true } : slot,
      ),
    },
  }),
  SecretObjectivesDealt: (state, event) => {
    const dealt = new Set<string>(event.choice.options);
    const secretDeck = state.objectives.secretDeck.filter((id) => !dealt.has(id));
    const next = { ...state, objectives: { ...state.objectives, secretDeck } };
    return updatePlayer(next, event.player, (p) => ({ ...p, secretChoice: event.choice }));
  },
  SecretObjectivesKept: (state, event) => {
    const next = { ...state, objectives: { ...state.objectives, secretDeck: event.secretDeck } };
    return updatePlayer(next, event.player, (p) => ({
      ...p,
      secretObjectives: [...p.secretObjectives, ...event.kept],
      secretChoice: null,
    }));
  },
  SecretObjectiveDrawn: draw,
  ObjectiveScored: score,
  VictoryPointsGained: (state, event) => addPoints(state, event.player, event.points),
  GameWon: (state, event) => ({ ...state, winner: event.player, phase: 'gameOver' }),
};
