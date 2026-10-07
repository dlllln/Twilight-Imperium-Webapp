import type { GameState } from '../game/game-state.ts';
import type { ObjectivesState, PublicObjectiveSlot } from '../objective/objective-state.ts';
import type { PlayerState } from '../player/player-state.ts';
import type { PlayerId } from '../shared/ids.ts';

/** Platzhalter für eine verdeckte Karte; Anzahl und Reihenfolge bleiben sichtbar. */
export const HIDDEN = 'verdeckt';

export const hidden = <T extends string>(ids: readonly T[]): readonly T[] =>
  ids.map(() => HIDDEN as T);

/** RR 12.13: unaufgedeckte öffentliche Aufträge zeigen nur ihre Stufe. */
export const slotView = (slot: PublicObjectiveSlot): PublicObjectiveSlot =>
  slot.revealed ? slot : { ...slot, id: HIDDEN as PublicObjectiveSlot['id'] };

export const objectivesView = (objectives: ObjectivesState): ObjectivesState => ({
  ...objectives,
  public: objectives.public.map(slotView),
  secretDeck: hidden(objectives.secretDeck),
});

/** RR 3.5, RR 12.17: Hand und ungewertete geheime Aufträge sieht nur ihr Besitzer. */
function opponentView(state: GameState, player: PlayerState): PlayerState {
  const scored = (id: string): boolean => (state.objectives.scored[id] ?? []).includes(player.id);
  const choice = player.secretChoice;
  return {
    ...player,
    actionCards: hidden(player.actionCards),
    secretObjectives: player.secretObjectives.map((id) =>
      scored(id) ? id : (HIDDEN as typeof id),
    ),
    secretChoice: choice === null ? null : { ...choice, options: hidden(choice.options) },
  };
}

/**
 * Was ein Spieler von der Partie sehen darf (Information Expert): Stapel bleiben verdeckt,
 * fremde Hände und Geheimaufträge werden zu Platzhaltern. `null` steht für Zuschauer.
 */
export function playerView(state: GameState, viewer: PlayerId | null): GameState {
  return {
    ...state,
    players: state.players.map((player) =>
      player.id === viewer ? player : opponentView(state, player),
    ),
    objectives: objectivesView(state.objectives),
    actionDeck: { ...state.actionDeck, deck: hidden(state.actionDeck.deck) },
    agendaDeck: { ...state.agendaDeck, deck: hidden(state.agendaDeck.deck) },
  };
}
