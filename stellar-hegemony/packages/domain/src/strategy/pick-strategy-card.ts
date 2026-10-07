import type { Command, CommandHandler } from '../eventsourcing/command.ts';
import type { GameState } from '../game/game-state.ts';
import type { ActionPhaseStarted } from '../phases/phase-events.ts';
import { type DomainError, firstFailure, guard } from '../shared/domain-error.ts';
import type { PlayerId } from '../shared/ids.ts';
import { ok, type Result } from '../shared/result.ts';
import type { StrategyCardId, StrategyCardState } from './strategy-card.ts';
import type { StrategyCardPicked, TradeGoodsPlacedOnCards } from './strategy-events.ts';

export interface PickStrategyCard extends Command<'PickStrategyCard'> {
  readonly card: StrategyCardId;
}

type PickEvent = StrategyCardPicked | TradeGoodsPlacedOnCards | ActionPhaseStarted;

/** RR 40: Reihenfolge nach der niedrigsten Initiative der eigenen Karten. */
export function orderByInitiative(
  players: readonly PlayerId[],
  cards: readonly StrategyCardState[],
): readonly PlayerId[] {
  const lowest = (player: PlayerId) =>
    Math.min(...cards.filter((card) => card.holder === player).map((card) => card.initiative));
  return [...players].sort((a, b) => lowest(a) - lowest(b));
}

/** Nach der letzten Wahl: Handelswaren auf übrige Karten, dann beginnt die Aktionsphase. */
function closingEvents(state: GameState, picked: StrategyCardPicked): readonly PickEvent[] {
  const cards = Object.values(state.strategyCards).map((card) =>
    card.id === picked.card ? { ...card, holder: picked.player } : card,
  );
  const unpicked = cards.filter((card) => card.holder === null).map((card) => card.id);
  const order = orderByInitiative(
    state.players.map((player) => player.id),
    cards,
  );
  return [
    { type: 'TradeGoodsPlacedOnCards', cards: unpicked },
    { type: 'ActionPhaseStarted', order },
  ];
}

export const pickStrategyCardHandler = {
  commandType: 'PickStrategyCard',
  decide(state: GameState, command: PickStrategyCard): Result<readonly PickEvent[], DomainError> {
    const card = state.strategyCards[command.card];
    const checked = firstFailure([
      guard(
        state.pickQueue[0] === command.issuedBy,
        'strategy.notYourPick',
        'Ein anderer Spieler wählt gerade',
      ),
      guard(card !== undefined, 'strategy.unknownCard', 'Unbekannte Strategiekarte'),
      guard(card?.holder === null, 'strategy.cardTaken', 'Die Karte ist bereits vergeben'),
    ]);
    if (!checked.ok) return checked;
    const picked: StrategyCardPicked = {
      type: 'StrategyCardPicked',
      player: command.issuedBy,
      card: command.card,
      tradeGoods: card?.tradeGoods ?? 0,
    };
    return ok(state.pickQueue.length === 1 ? [picked, ...closingEvents(state, picked)] : [picked]);
  },
} as const satisfies CommandHandler<GameState, PickStrategyCard, PickEvent>;
