import type { Command, CommandHandler, DecisionContext } from '../eventsourcing/command.ts';
import { evaluatePayment } from '../economy/payment.ts';
import { evolveGame, type GameEvent } from '../game/game-events.ts';
import type { GameState } from '../game/game-state.ts';
import { type DomainError, domainError, firstFailure, guard } from '../shared/domain-error.ts';
import type { PlanetId, PlayerId } from '../shared/ids.ts';
import { andThen, err, ok, type Result } from '../shared/result.ts';
import { afterVoting, findAgenda, resolveAgenda } from './agenda-flow.ts';
import type { OutcomeId } from './agenda-state.ts';
import { lawVotes } from './law-effects.ts';
import { outcomesFor } from './voting.ts';

/** RR 2.6: Planeten erschöpfen und alle Stimmen für ein Ergebnis abgeben. */
export interface CastVotes extends Command<'CastVotes'> {
  readonly outcome: OutcomeId;
  readonly planets: readonly PlanetId[];
}

/** RR 2.14: sich enthalten. */
export type Abstain = Command<'Abstain'>;

/** RR 2.19: der Sprecher entscheidet einen Gleichstand. */
export interface BreakTie extends Command<'BreakTie'> {
  readonly outcome: OutcomeId;
}

type Events = Result<readonly GameEvent[], DomainError>;

const onTurn = (state: GameState, player: PlayerId) =>
  guard(
    state.agendaPhase?.awaiting[0] === player,
    'agenda.notYourTurn',
    'Du bist bei dieser Abstimmung nicht dran',
  );

/** Nach der Stimmabgabe geht es weiter: nächster Spieler oder Auszählung. */
const continued = (state: GameState, event: GameEvent, context: DecisionContext): Events => {
  const after = evolveGame(state, event);
  return ok([event, ...afterVoting(after, context)]);
};

/** RR 2.6/2.13: Einfluss der erschöpften Planeten plus Stimmen aus Gesetzen; keine Handelswaren. */
function voteCount(state: GameState, command: CastVotes, context: DecisionContext) {
  const payment = { planets: command.planets, tradeGoods: 0 };
  return andThen(
    evaluatePayment(state, context.content.tiles, command.issuedBy, payment, 'influence'),
    (influence) => {
      const votes = influence + lawVotes(state, command.issuedBy);
      return votes > 0 ? ok(votes) : err(domainError('agenda.noVotes', 'Keine Stimmen'));
    },
  );
}

function outcomeValid(state: GameState, outcome: OutcomeId, context: DecisionContext): boolean {
  const agenda =
    state.agendaPhase === null ? undefined : findAgenda(context.content, state.agendaPhase.agenda);
  return agenda !== undefined && outcomesFor(state, agenda, context.content).includes(outcome);
}

const castChecks = (state: GameState, command: CastVotes, context: DecisionContext) =>
  firstFailure([
    onTurn(state, command.issuedBy),
    guard(
      outcomeValid(state, command.outcome, context),
      'agenda.invalidOutcome',
      'Ungültiges Ergebnis',
    ),
  ]);

export const castVotesHandler = {
  commandType: 'CastVotes',
  decide(state: GameState, command: CastVotes, context: DecisionContext): Events {
    const checked = castChecks(state, command, context);
    if (!checked.ok) return checked;
    const { issuedBy: player, outcome, planets } = command;
    return andThen(voteCount(state, command, context), (votes) =>
      continued(state, { type: 'VotesCast', player, outcome, planets, votes }, context),
    );
  },
} as const satisfies CommandHandler<GameState, CastVotes, GameEvent>;

export const abstainHandler = {
  commandType: 'Abstain',
  decide(state: GameState, command: Abstain, context: DecisionContext): Events {
    const checked = onTurn(state, command.issuedBy);
    if (!checked.ok) return checked;
    return continued(state, { type: 'PlayerAbstained', player: command.issuedBy }, context);
  },
} as const satisfies CommandHandler<GameState, Abstain, GameEvent>;

export const breakTieHandler = {
  commandType: 'BreakTie',
  decide(state: GameState, command: BreakTie, context: DecisionContext): Events {
    const tied = state.agendaPhase?.tied ?? [];
    const checked = firstFailure([
      guard(tied.length > 0, 'agenda.noTie', 'Es gibt keinen Gleichstand'),
      guard(
        command.issuedBy === state.speaker,
        'agenda.notSpeaker',
        'Nur der Sprecher entscheidet',
      ),
      guard(tied.includes(command.outcome), 'agenda.invalidOutcome', 'Ungültiges Ergebnis'),
    ]);
    if (!checked.ok) return checked;
    return ok(resolveAgenda(state, command.outcome, context));
  },
} as const satisfies CommandHandler<GameState, BreakTie, GameEvent>;
