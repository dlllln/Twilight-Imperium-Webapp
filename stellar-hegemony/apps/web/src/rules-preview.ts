import {
  decideGameCommand,
  type DomainError,
  evolveGame,
  type GameCommand,
  type GameState,
  map,
  type Result,
} from '@stellar/domain';
import { SeededRandom } from '@stellar/infrastructure';
import { content } from './store.ts';

/** Fester Zufall: Vorschauen fragen nur, ob ein Schritt erlaubt ist, gewürfelt wird auf dem Server. */
const PREVIEW_SEED = 1;

/**
 * Erprobt einen Command an einer Kopie des eigenen Spielstands, ohne ihn zu senden. So zeigt die
 * Oberfläche nur Knöpfe, die die Domain auch erlaubt; entschieden wird trotzdem auf dem Server.
 */
export const tryCommand = (
  state: GameState,
  command: GameCommand,
): Result<GameState, DomainError> =>
  map(
    decideGameCommand(state, command, {
      random: new SeededRandom(PREVIEW_SEED + state.version),
      now: Date.now(),
      content,
    }),
    (events) => events.reduce(evolveGame, state),
  );
