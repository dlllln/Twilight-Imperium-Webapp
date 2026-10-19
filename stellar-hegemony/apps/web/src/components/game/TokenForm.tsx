import {
  COMMAND_POOLS,
  type CommandPool,
  type CommandTokensChoice,
  type GameState,
  type Payment,
  type PlayerId,
  type PoolCounts,
  previewCommandTokens,
  type StrategyCardDefinition,
} from '@stellar/domain';
import { SeededRandom } from '@stellar/infrastructure';
import { type ReactElement, type ReactNode, useState } from 'react';
import { content } from '../../store.ts';
import { useT } from '../../use-translation.ts';
import { Actions } from './FormParts.tsx';
import { PaymentPicker, usePayment } from './PaymentPicker.tsx';

const EMPTY: PoolCounts = { tactic: 0, fleet: 0, strategy: 0 };

interface TokenFormProps {
  readonly game: GameState;
  readonly player: PlayerId;
  readonly card: StrategyCardDefinition;
  readonly ability: 'primary' | 'secondary';
  readonly onSubmit: (choice: CommandTokensChoice) => void;
  readonly children?: ReactNode;
}

/** Fragt die Domain, wie viele Marker die Bezahlung bringt (keine doppelte Regel im Client). */
function gainFor(props: TokenFormProps, influence: Payment): number {
  const { game, player, card, ability } = props;
  const context = { random: new SeededRandom(0), now: 0, content };
  const preview = previewCommandTokens({ state: game, player, card, context, influence }, ability);
  return preview.ok ? preview.value : 0;
}

interface StepperProps {
  readonly pool: CommandPool;
  readonly value: number;
  readonly canAdd: boolean;
  readonly change: (pool: CommandPool, delta: number) => void;
}

function PoolStepper({ pool, value, canAdd, change }: StepperProps): ReactElement {
  const t = useT();
  const step = (delta: number, symbol: string, enabled: boolean) => (
    <button
      type="button"
      aria-label={`${t(pool)} ${symbol}`}
      disabled={!enabled}
      onClick={() => change(pool, delta)}
    >
      {symbol}
    </button>
  );
  return (
    <div className="stepper">
      <span>{t(pool)}</span>
      {step(-1, '−', value > 0)}
      <output aria-label={t(pool)}>{value}</output>
      {step(1, '+', canAdd)}
    </div>
  );
}

/** Erkennungszeichen einer Bezahlung: Ändert sie sich, beginnt die Verteilung von vorn. */
const paymentKey = (payment: Payment): string =>
  `${payment.planets.join(',')}|${String(payment.tradeGoods)}`;

interface Allocated {
  readonly key: string;
  readonly allocation: PoolCounts;
}

const sum = (pools: PoolCounts): number =>
  COMMAND_POOLS.reduce((all, pool) => all + pools[pool], 0);

/**
 * Zustand des Formulars: Einfluss aus Planeten und Handelswaren (geteilter Entwurf mit dem Tisch)
 * und die Verteilung. Jede Änderung der Bezahlung, gleich wo, setzt die Verteilung zurück.
 */
function useTokenChoice(props: TokenFormProps) {
  const payment = usePayment(props.game, props.player, 'influence');
  const key = paymentKey(payment.payment);
  const [allocated, setAllocated] = useState<Allocated>({ key, allocation: EMPTY });
  const allocation = allocated.key === key ? allocated.allocation : EMPTY;
  const gained = gainFor(props, payment.payment);
  const change = (pool: CommandPool, delta: number) =>
    setAllocated((current) => {
      const base = current.key === key ? current.allocation : EMPTY;
      return { key, allocation: { ...base, [pool]: base[pool] + delta } };
    });
  const choice = (): CommandTokensChoice => ({
    mechanic: 'commandTokens',
    influence: payment.payment,
    allocation,
  });
  return { payment, allocation, gained, remaining: gained - sum(allocation), change, choice };
}

function GainLine(props: { readonly gained: number; readonly remaining: number }): ReactElement {
  const t = useT();
  return (
    <p>
      {t('tokensGained')}: <strong data-testid="tokens-gained">{props.gained}</strong> (
      {t('toDistribute')}: {props.remaining})
    </p>
  );
}

type TokenChoice = ReturnType<typeof useTokenChoice>;

function PoolSteppers({ form }: { readonly form: TokenChoice }): ReactElement {
  return (
    <>
      {COMMAND_POOLS.map((pool) => (
        <PoolStepper
          key={pool}
          pool={pool}
          value={form.allocation[pool]}
          canAdd={form.remaining > 0}
          change={form.change}
        />
      ))}
    </>
  );
}

/** Auswahl für „Kommandomarker gewinnen“: Einfluss aus Planeten und Handelswaren, Marker verteilen. */
export function TokenForm(props: TokenFormProps): ReactElement {
  const t = useT();
  const form = useTokenChoice(props);
  return (
    <div className="token-form">
      <PaymentPicker
        game={props.game}
        player={props.player}
        currency="influence"
        required={0}
        state={form.payment}
      />
      <GainLine gained={form.gained} remaining={form.remaining} />
      <PoolSteppers form={form} />
      <Actions
        label={t('confirm')}
        disabled={form.remaining !== 0}
        onClick={() => props.onSubmit(form.choice())}
      >
        {props.children}
      </Actions>
    </div>
  );
}
