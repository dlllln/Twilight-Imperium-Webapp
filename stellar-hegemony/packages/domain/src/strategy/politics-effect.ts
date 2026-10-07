import type { GameEvent } from '../game/game-events.ts';
import { findPlayer } from '../game/game-state.ts';
import { type DomainError, guard } from '../shared/domain-error.ts';
import { andThen, ok, type Result } from '../shared/result.ts';
import { choiceOf, type EffectInput, type StrategyEffect } from './strategy-effect.ts';

type Events = Result<readonly GameEvent[], DomainError>;

/** RR 61.2 i: ein Spieler ohne Sprechermarker wird Sprecher, auch der aktive selbst. */
function primary(input: EffectInput): Events {
  const { state } = input;
  return andThen(choiceOf(input, 'politics'), ({ speaker }) =>
    andThen(
      guard(
        speaker !== null && findPlayer(state, speaker) !== undefined && speaker !== state.speaker,
        'politics.speaker',
        'Wähle einen Spieler ohne Sprechermarker',
      ),
      () => ok([{ type: 'SpeakerChanged', player: speaker } as GameEvent]),
    ),
  );
}

/** RR 61.3: Aktionskarten ziehen; der Aktionskartenstapel kommt mit Iteration 9. */
const secondary = (): Events => ok([]);

export const politicsEffect: StrategyEffect = { mechanic: 'politics', primary, secondary };
