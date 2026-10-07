import { drawEvents } from '../action-card/draw.ts';
import type { GameEvent } from '../game/game-events.ts';
import { findPlayer } from '../game/game-state.ts';
import { type DomainError, guard } from '../shared/domain-error.ts';
import { andThen, map, type Result } from '../shared/result.ts';
import { choiceOf, type EffectInput, parameterOf, type StrategyEffect } from './strategy-effect.ts';

type Events = Result<readonly GameEvent[], DomainError>;

/** RR 61.2 ii und 61.3: Aktionskarten laut Kartenparameter ziehen. */
const draw = ({ state, player, card, context }: EffectInput): Events =>
  map(parameterOf(card, 'actionCards'), (count) =>
    drawEvents(state, player, count, context.random),
  );

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
      () =>
        map(draw(input), (drawn) => [
          { type: 'SpeakerChanged', player: speaker } as GameEvent,
          ...drawn,
        ]),
    ),
  );
}

export const politicsEffect: StrategyEffect = { mechanic: 'politics', primary, secondary: draw };
