import {
  type GameState,
  type ObjectiveCondition,
  type ObjectiveOption,
  type Payment,
  type PlayerId,
} from '@stellar/domain';
import { type ReactElement, useState } from 'react';
import { useGameStore } from '../../game-store.ts';
import { useT } from '../../use-translation.ts';
import { PaymentPicker, usePayment } from '../game/PaymentPicker.tsx';

type Spend = Extract<ObjectiveCondition, { kind: 'spend' }>;

const spendOf = (option: ObjectiveOption): Spend | null =>
  option.definition.condition.kind === 'spend' ? option.definition.condition : null;

interface ScoreProps {
  readonly game: GameState;
  readonly player: PlayerId;
  readonly option: ObjectiveOption;
}

/** Ressourcen oder Einfluss: erst die Bezahlung wählen, dann werten. */
function SpendScore({ game, player, option, spend }: ScoreProps & { readonly spend: Spend }) {
  const t = useT();
  const send = useGameStore((state) => state.send);
  const currency = spend.currency === 'influence' ? 'influence' : 'resources';
  const payment = usePayment(game, player, currency);
  const score = () =>
    send({
      type: 'ScoreObjective',
      issuedBy: player,
      objective: option.definition.id,
      payment: payment.payment,
    });
  return (
    <div className="score-spend">
      <PaymentPicker
        game={game}
        player={player}
        currency={currency}
        required={spend.amount}
        state={payment}
      />
      <button type="button" disabled={payment.value < spend.amount} onClick={score}>
        {t('score')}
      </button>
    </div>
  );
}

/** Werten-Knopf eines Auftrags; Handelswaren-Aufträge zahlen genau den Betrag. */
export function ScoreAction(props: ScoreProps): ReactElement {
  const t = useT();
  const send = useGameStore((state) => state.send);
  const [paying, setPaying] = useState(false);
  const spend = spendOf(props.option);
  if (spend !== null && spend.currency !== 'tradeGoods' && paying)
    return <SpendScore {...props} spend={spend} />;
  const payment: Payment = { planets: [], tradeGoods: spend?.amount ?? 0 };
  const score = () =>
    spend !== null && spend.currency !== 'tradeGoods'
      ? setPaying(true)
      : send({
          type: 'ScoreObjective',
          issuedBy: props.player,
          objective: props.option.definition.id,
          payment,
        });
  return (
    <button type="button" className="score" disabled={!props.option.met} onClick={score}>
      {t('score')}
    </button>
  );
}
