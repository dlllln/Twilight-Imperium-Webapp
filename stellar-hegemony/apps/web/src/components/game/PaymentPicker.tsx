import { type Currency, findPlayer, type GameState, type PlayerId } from '@stellar/domain';
import { type ReactElement, useRef } from 'react';
import { planetLabel } from '../../labels.ts';
import { payablePlanets } from '../../payment-view.ts';
import { content } from '../../store.ts';
import {
  type PaymentState,
  useClaimPayment,
  usePaymentDraft,
  usePlanetRowShown,
} from '../../table/payment-store.ts';
import { payHintOf } from '../../table/planet-table.ts';
import { useLanguage, useT } from '../../use-translation.ts';
import { useRevealInPrompt } from '../table/use-reveal-in-prompt.ts';

export type { PaymentState } from '../../table/payment-store.ts';

/** Bezahlung aus erschöpften Planeten und Handelswaren; Formular und Tisch teilen den Entwurf. */
export function usePayment(game: GameState, player: PlayerId, currency: Currency): PaymentState {
  return usePaymentDraft(game, player, currency);
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

type LineProps = Omit<PickerProps, 'game' | 'player'>;

/** „bezahlt / benötigt“; ohne festen Betrag (Führung) nur „bezahlt“. */
function PaidLine({ currency, required, state }: LineProps): ReactElement {
  const t = useT();
  return (
    <>
      {t(currency)}: <strong data-testid="paid">{state.value}</strong>
      {required > 0 && ` / ${String(required)}`}
    </>
  );
}

/** Am Tisch: nur „bezahlt / benötigt“; Planeten und Münzen legt man auf Pult und Karte. */
function PaymentMeter({ game, player, currency, required, state }: PickerProps) {
  const t = useT();
  const meter = useRef<HTMLParagraphElement>(null);
  useRevealInPrompt(meter);
  const own = findPlayer(game, player)?.tradeGoods ?? 0;
  return (
    <>
      <p ref={meter} className="payment-meter" aria-live="polite" aria-atomic="true">
        <PaidLine currency={currency} required={required} state={state} />
      </p>
      <p className="hint payment-hint">{t(payHintOf(own))}</p>
    </>
  );
}

/** Das Formular: Planeten als Kontrollkästchen und Handelswaren als Zahl. */
function PaymentFields({ game, player, currency, required, state }: PickerProps): ReactElement {
  const language = useLanguage();
  return (
    <fieldset className="payment">
      <legend>
        <PaidLine currency={currency} required={required} state={state} />
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

/**
 * Planeten zum Erschöpfen und Handelswaren; zeigt „bezahlt / benötigt“. Steht am Pult eine
 * Planetenreihe, hält der Tisch die einzigen Bedienelemente und hier bleibt die Messleiste.
 */
export function PaymentPicker(props: PickerProps): ReactElement {
  const onTable = usePlanetRowShown();
  useClaimPayment(props.state, props.player, props.required);
  return onTable ? <PaymentMeter {...props} /> : <PaymentFields {...props} />;
}
