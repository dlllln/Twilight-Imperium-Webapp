import type { GameState, PlayerId } from '@stellar/domain';

/** Was jedes Formular einer Entscheidung braucht: den Spielstand und wer entscheidet. */
export interface TurnProps {
  readonly game: GameState;
  readonly player: PlayerId;
}
