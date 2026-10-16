import {
  COMMAND_POOLS,
  type CommandPool,
  findPlayer,
  type GameState,
  type PlayerId,
  type PoolCounts,
  type StrategyCardDefinition,
  type SystemId,
  type WarfareChoice,
} from '@stellar/domain';
import { type ReactElement, type ReactNode, useState } from 'react';
import { homeSystemOf, systemsWithToken } from '../../card-view.ts';
import { content } from '../../store.ts';
import { useT } from '../../use-translation.ts';
import { Actions, SystemSelect } from './FormParts.tsx';
import { ProductionForm } from './ProductionForm.tsx';
import { Stepper } from './Stepper.tsx';

export interface WarfareFormProps {
  readonly game: GameState;
  readonly player: PlayerId;
  readonly card: StrategyCardDefinition;
  readonly ability: 'primary' | 'secondary';
  readonly onSubmit: (choice: WarfareChoice) => void;
  readonly children?: ReactNode;
}

const NO_POOLS: PoolCounts = { tactic: 0, fleet: 0, strategy: 0 };
const sum = (pools: PoolCounts) => COMMAND_POOLS.reduce((total, pool) => total + pools[pool], 0);

/** Neue Verteilung: Start bei den aktuellen Pools, ein zurückgenommener Marker ist noch frei. */
function usePools(game: GameState, player: PlayerId, system: SystemId | null) {
  const current = findPlayer(game, player)?.commandPools ?? NO_POOLS;
  const [pools, setPools] = useState(current);
  const free = sum(current) + (system !== null ? 1 : 0) - sum(pools);
  const change = (pool: CommandPool, delta: number) =>
    setPools((before) => ({ ...before, [pool]: before[pool] + delta }));
  return { pools, free, change };
}

type Pools = ReturnType<typeof usePools>;

function PoolSteppers({ form }: { readonly form: Pools }): ReactElement {
  const t = useT();
  return (
    <>
      <p className="hint">
        {t('toDistribute')}: {form.free}
      </p>
      {COMMAND_POOLS.map((pool) => (
        <Stepper
          key={pool}
          label={t(pool)}
          value={form.pools[pool]}
          canAdd={form.free > 0}
          onChange={(delta) => form.change(pool, delta)}
        />
      ))}
    </>
  );
}

/** Ohne eigenen Marker auf der Karte wird nur umverteilt (`system: null`). */
function PrimaryWarfare(props: WarfareFormProps): ReactElement {
  const t = useT();
  const systems = systemsWithToken(props.game, props.player);
  const [system, setSystem] = useState<SystemId | null>(systems[0] ?? null);
  const form = usePools(props.game, props.player, system);
  const none = systems.length === 0;
  const submit = () =>
    props.onSubmit({ mechanic: 'warfare', system, pools: form.pools, production: null });
  const blocked = (!none && system === null) || form.free !== 0;
  return (
    <div className="choice-form">
      {!none && (
        <SystemSelect
          game={props.game}
          label={t('takeBackToken')}
          options={systems}
          value={system}
          onChange={setSystem}
        />
      )}
      <PoolSteppers form={form} />
      <Actions label={t(none ? 'withoutToken' : 'confirm')} disabled={blocked} onClick={submit}>
        {props.children}
      </Actions>
    </div>
  );
}

function SecondaryWarfare(props: WarfareFormProps): ReactElement {
  const t = useT();
  const home = homeSystemOf(props.game, props.player, content);
  const pools = findPlayer(props.game, props.player)?.commandPools ?? NO_POOLS;
  if (home === null) return <p className="hint">{t('noHomeSystem')}</p>;
  return (
    <ProductionForm
      game={props.game}
      player={props.player}
      system={home}
      onSubmit={(production) =>
        props.onSubmit({ mechanic: 'warfare', system: null, pools, production })
      }
    >
      {props.children}
    </ProductionForm>
  );
}

/** Kriegsführung: primär Marker zurücknehmen und umverteilen, sekundär im Heimatsystem produzieren. */
export function WarfareForm(props: WarfareFormProps): ReactElement {
  return props.ability === 'primary' ? (
    <PrimaryWarfare {...props} />
  ) : (
    <SecondaryWarfare {...props} />
  );
}
