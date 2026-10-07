import type { Command, CommandHandler } from '../eventsourcing/command.ts';
import type { GameEvent } from '../game/game-events.ts';
import { findPlayer, type GameState } from '../game/game-state.ts';
import {
  type Check,
  type DomainError,
  domainError,
  firstFailure,
  guard,
} from '../shared/domain-error.ts';
import type { PlayerId } from '../shared/ids.ts';
import { err, map, ok, type Result } from '../shared/result.ts';
import { type Goods, isValidGoods, type PendingTransaction } from './goods.ts';
import { areNeighbors } from './neighbors.ts';

export interface ProposeTransaction extends Command<'ProposeTransaction'> {
  readonly partner: PlayerId;
  readonly offer: Goods;
  readonly request: Goods;
}

export type AcceptTransaction = Command<'AcceptTransaction'>;
export type RejectTransaction = Command<'RejectTransaction'>;

type Events = Result<readonly GameEvent[], DomainError>;

/** Hat der Spieler die Waren (noch)? */
function owns(state: GameState, player: PlayerId, goods: Goods): boolean {
  const found = findPlayer(state, player);
  return (
    found !== undefined &&
    found.tradeGoods >= goods.tradeGoods &&
    found.commodities >= goods.commodities
  );
}

function proposalChecks(state: GameState, command: ProposeTransaction): Check {
  const { issuedBy, partner, offer, request } = command;
  const turn = state.actionPhase;
  return firstFailure([
    guard(turn?.active === issuedBy, 'action.notYourTurn', 'Du bist nicht am Zug'),
    guard(turn?.transaction === null, 'transaction.pending', 'Es ist schon ein Angebot offen'),
    guard(areNeighbors(state, issuedBy, partner), 'transaction.notNeighbor', 'Nur mit Nachbarn'),
    guard(
      turn?.transactedWith.includes(partner) !== true,
      'transaction.alreadyDone',
      'Mit diesem Nachbarn schon gehandelt',
    ),
    guard(
      isValidGoods(offer) && isValidGoods(request),
      'transaction.invalidGoods',
      'Ungültige Mengen',
    ),
    guard(owns(state, issuedBy, offer), 'transaction.notEnough', 'So viel hast du nicht'),
  ]);
}

/** RR 82.1/82.2: Der aktive Spieler bietet einem Nachbarn einmal je Zug einen Tausch an. */
export const proposeTransactionHandler = {
  commandType: 'ProposeTransaction',
  decide(state: GameState, command: ProposeTransaction): Events {
    const { issuedBy: from, partner: to, offer, request } = command;
    return map(proposalChecks(state, command), () => [
      { type: 'TransactionProposed', from, to, offer, request } as const,
    ]);
  },
} as const satisfies CommandHandler<GameState, ProposeTransaction, GameEvent>;

const pendingFor = (
  state: GameState,
  player: PlayerId,
): Result<PendingTransaction, DomainError> => {
  const pending = state.actionPhase?.transaction ?? null;
  return pending?.to === player
    ? ok(pending)
    : err(domainError('transaction.noOffer', 'Kein Angebot an dich offen'));
};

/** RR 82.4: Erst mit der Zustimmung wechseln die Waren den Besitzer. */
export const acceptTransactionHandler = {
  commandType: 'AcceptTransaction',
  decide(state: GameState, command: AcceptTransaction): Events {
    const pending = pendingFor(state, command.issuedBy);
    if (!pending.ok) return pending;
    const { from, to, offer, request } = pending.value;
    const affordable = owns(state, from, offer) && owns(state, to, request);
    return map(guard(affordable, 'transaction.notEnough', 'Die Waren reichen nicht'), () => [
      { type: 'TransactionCompleted', from, to, offer, request } as const,
    ]);
  },
} as const satisfies CommandHandler<GameState, AcceptTransaction, GameEvent>;

/** Der Empfänger lehnt ab oder der Anbieter zieht zurück; der Zug geht weiter. */
export const rejectTransactionHandler = {
  commandType: 'RejectTransaction',
  decide(state: GameState, command: RejectTransaction): Events {
    const pending = state.actionPhase?.transaction ?? null;
    const involved = pending !== null && [pending.from, pending.to].includes(command.issuedBy);
    if (pending === null || !involved)
      return err(domainError('transaction.noOffer', 'Kein Angebot offen'));
    return ok([{ type: 'TransactionRejected', from: pending.from, to: pending.to }]);
  },
} as const satisfies CommandHandler<GameState, RejectTransaction, GameEvent>;
