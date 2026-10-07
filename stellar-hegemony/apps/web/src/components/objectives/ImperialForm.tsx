import {
  availableObjectives,
  type GameState,
  type ImperialChoice,
  type ObjectiveDefinition,
  type PlayerId,
  type StrategyCardDefinition,
} from '@stellar/domain';
import { type ReactElement, type ReactNode, useState } from 'react';
import { objectiveLabel } from '../../labels.ts';
import { content } from '../../store.ts';
import { useLanguage, useT } from '../../use-translation.ts';
import { Actions } from '../game/FormParts.tsx';
import { PaymentPicker, usePayment } from '../game/PaymentPicker.tsx';

export interface ImperialFormProps {
  readonly game: GameState;
  readonly player: PlayerId;
  readonly card: StrategyCardDefinition;
  readonly ability: 'primary' | 'secondary';
  readonly onSubmit: (choice: ImperialChoice) => void;
  readonly children?: ReactNode;
}

/** Aufgedeckte öffentliche Aufträge, deren Anforderung der Spieler schon erfüllt. */
const metPublic = (game: GameState, player: PlayerId): readonly ObjectiveDefinition[] =>
  availableObjectives(game, player, content)
    .filter((option) => option.met && option.definition.category === 'public')
    .map((option) => option.definition);

/** Ausgaben in Ressourcen oder Einfluss; Handelswaren zahlt die Domain direkt. */
const spentCurrency = (definition: ObjectiveDefinition | undefined) => {
  const condition = definition?.condition;
  if (condition?.kind !== 'spend' || condition.currency === 'tradeGoods') return null;
  return { currency: condition.currency, amount: condition.amount };
};

const tradeGoodsOf = (definition: ObjectiveDefinition | undefined): number =>
  definition?.condition.kind === 'spend' ? definition.condition.amount : 0;

function ObjectiveSelect(props: {
  readonly options: readonly ObjectiveDefinition[];
  readonly value: string;
  readonly onChange: (id: string) => void;
}): ReactElement {
  const t = useT();
  const language = useLanguage();
  return (
    <label>
      {t('chooseObjective')}
      <select value={props.value} onChange={(event) => props.onChange(event.target.value)}>
        <option value="">{t('noObjective')}</option>
        {props.options.map((definition) => (
          <option key={definition.id} value={definition.id}>
            {objectiveLabel(definition.id, language)} ({definition.points})
          </option>
        ))}
      </select>
    </label>
  );
}

/** Bezahlung zum gewählten Auftrag: Planeten bei Ressourcen/Einfluss, sonst genau die Handelswaren. */
function useImperialChoice(props: ImperialFormProps, chosen: string) {
  const definition = metPublic(props.game, props.player).find((option) => option.id === chosen);
  const spend = spentCurrency(definition);
  const payment = usePayment(props.game, props.player, spend?.currency ?? 'resources');
  const choice: ImperialChoice = {
    mechanic: 'imperial',
    objective: definition?.id ?? null,
    payment:
      spend === null ? { planets: [], tradeGoods: tradeGoodsOf(definition) } : payment.payment,
  };
  return { choice, spend, payment, unpaid: spend !== null && payment.value < spend.amount };
}

/** Primär: wahlweise einen erfüllten öffentlichen Auftrag werten (mit Bezahlung, falls nötig). */
function ImperialPrimary(props: ImperialFormProps): ReactElement {
  const t = useT();
  const [chosen, setChosen] = useState('');
  const { choice, spend, payment, unpaid } = useImperialChoice(props, chosen);
  return (
    <div className="choice-form">
      <ObjectiveSelect
        options={metPublic(props.game, props.player)}
        value={chosen}
        onChange={setChosen}
      />
      {spend !== null && (
        <PaymentPicker
          game={props.game}
          player={props.player}
          currency={spend.currency}
          required={spend.amount}
          state={payment}
        />
      )}
      <Actions label={t('confirm')} disabled={unpaid} onClick={() => props.onSubmit(choice)}>
        {props.children}
      </Actions>
    </div>
  );
}

/** Thronkarte: primär werten und Thron-Siegpunkt oder Geheimauftrag, sekundär ein Geheimauftrag. */
export function ImperialForm(props: ImperialFormProps): ReactElement {
  const t = useT();
  if (props.ability === 'primary') return <ImperialPrimary {...props} />;
  const choice: ImperialChoice = {
    mechanic: 'imperial',
    objective: null,
    payment: { planets: [], tradeGoods: 0 },
  };
  return (
    <Actions label={t('drawSecret')} onClick={() => props.onSubmit(choice)}>
      {props.children}
    </Actions>
  );
}
