import {
  type Currency,
  findPlayer,
  type GameState,
  type Payment,
  type PlanetId,
  type PlayerId,
} from '@stellar/domain';
import { type ReactElement, useState } from 'react';
import { planetLabel } from '../../labels.ts';
import { payablePlanets, paymentValue } from '../../payment-view.ts';
import { content } from '../../store.ts';
import { useLanguage, useT } from '../../use-translation.ts';

export interface PaymentState {
  readonly payment: Payment;
  readonly value: number;
  readonly togglePlanet: (planet: PlanetId) => void;
  readonly setTradeGoods: (amount: number) => void;
}

/** Bezahlung aus erschöpften Planeten und Handelswaren; der Wert kommt aus der Domain. */
export function usePayment(game: GameState, player: PlayerId, currency: Currency): PaymentState {
  const [payment, setPayment] = useState<Payment>({ planets: [], tradeGoods: 0 });
  const togglePlanet = (planet: PlanetId) =>
    setPayment((current) => ({
      ...current,
      planets: current.planets.includes(planet)
        ? current.planets.filter((id) => id !== planet)
        : [...current.planets, planet],
    }));
  const setTradeGoods = (tradeGoods: number) =>
    setPayment((current) => ({ ...current, tradeGoods }));
  const value = paymentValue(game, player, payment, content, currency);
  return { payment, value, togglePlanet, setTradeGoods };
}

interface PickerProps {
  readonly game: GameState;
  readonly player: PlayerId;
  readonly currency: Currency;
  readonly required: number;
  readonly state: PaymentState;
}

function TradeGoodsField({ game, player, state }: Omit<PickerProps, 'currency' | 'required'>) {
  const t = useT();
  const available = findPlayer(game, player)?.tradeGoods ?? 0;
  return (
    <label>
      {t('tradeGoods')}
      <input
        type="number"
        min={0}
        max={available}
        value={state.payment.tradeGoods}
        onChange={(event) =>
          state.setTradeGoods(Math.min(available, Math.max(0, Number(event.target.value))))
        }
      />
    </label>
  );
}

/** Planeten zum Erschöpfen und Handelswaren; zeigt „bezahlt / benötigt“. */
export function PaymentPicker(props: PickerProps): ReactElement {
  const t = useT();
  const language = useLanguage();
  const { game, player, currency, required, state } = props;
  return (
    <fieldset className="payment">
      <legend>
        {t(currency)}: <strong data-testid="paid">{state.value}</strong> / {required}
      </legend>
      {payablePlanets(game, player, content, currency).map(({ planet, value }) => (
        <label key={planet}>
          <input
            type="checkbox"
            checked={state.payment.planets.includes(planet)}
            onChange={() => state.togglePlanet(planet)}
          />
          {planetLabel(planet, language)} ({value})
        </label>
      ))}
      <TradeGoodsField game={game} player={player} state={state} />
    </fieldset>
  );
}
