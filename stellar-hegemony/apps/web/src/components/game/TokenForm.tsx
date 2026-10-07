import {
  COMMAND_POOLS,
  type CommandPool,
  type CommandTokensChoice,
  findPlayer,
  type GameState,
  type PlayerId,
  type PoolCounts,
  previewCommandTokens,
  type StrategyCardDefinition,
} from '@stellar/domain';
import { SeededRandom } from '@stellar/infrastructure';
import { type ReactElement, type ReactNode, useState } from 'react';
import { content } from '../../store.ts';
import { useT } from '../../use-translation.ts';

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
function gainFor(props: TokenFormProps, tradeGoods: number): number {
  const { game, player, card, ability } = props;
  const context = { random: new SeededRandom(0), now: 0, content };
  const influence = { planets: [], tradeGoods };
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

function TradeGoodsInput(props: {
  readonly max: number;
  readonly value: number;
  readonly onChange: (value: number) => void;
}): ReactElement {
  const t = useT();
  return (
    <label>
      {t('spendTradeGoods')}
      <input
        type="number"
        min={0}
        max={props.max}
        value={props.value}
        onChange={(event) =>
          props.onChange(Math.min(props.max, Math.max(0, Number(event.target.value))))
        }
      />
    </label>
  );
}

/** Zustand des Formulars; jede Änderung der Bezahlung setzt die Verteilung zurück. */
function useTokenChoice(props: TokenFormProps) {
  const [tradeGoods, setTradeGoods] = useState(0);
  const [allocation, setAllocation] = useState(EMPTY);
  const gained = gainFor(props, tradeGoods);
  return {
    tradeGoods,
    allocation,
    gained,
    remaining: gained - COMMAND_POOLS.reduce((sum, pool) => sum + allocation[pool], 0),
    available: findPlayer(props.game, props.player)?.tradeGoods ?? 0,
    pay: (value: number) => {
      setTradeGoods(value);
      setAllocation(EMPTY);
    },
    change: (pool: CommandPool, delta: number) =>
      setAllocation((current) => ({ ...current, [pool]: current[pool] + delta })),
    choice: (): CommandTokensChoice => ({
      mechanic: 'commandTokens',
      influence: { planets: [], tradeGoods },
      allocation,
    }),
  };
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

/** Auswahl für „Kommandomarker gewinnen“: Einfluss bezahlen und Marker verteilen. */
export function TokenForm(props: TokenFormProps): ReactElement {
  const t = useT();
  const form = useTokenChoice(props);
  return (
    <div className="token-form">
      <TradeGoodsInput max={form.available} value={form.tradeGoods} onChange={form.pay} />
      <GainLine gained={form.gained} remaining={form.remaining} />
      {COMMAND_POOLS.map((pool) => (
        <PoolStepper
          key={pool}
          pool={pool}
          value={form.allocation[pool]}
          canAdd={form.remaining > 0}
          change={form.change}
        />
      ))}
      <div className="actions">
        <button
          type="button"
          disabled={form.remaining !== 0}
          onClick={() => props.onSubmit(form.choice())}
        >
          {t('confirm')}
        </button>
        {props.children}
      </div>
    </div>
  );
}
