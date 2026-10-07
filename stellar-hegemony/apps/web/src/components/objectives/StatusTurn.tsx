import {
  COMMAND_POOLS,
  type CommandPool,
  findPlayer,
  type GameState,
  type PlayerId,
  type PoolCounts,
  scoringOptions,
} from '@stellar/domain';
import { type ReactElement, useState } from 'react';
import { useGameStore } from '../../game-store.ts';
import { content } from '../../store.ts';
import { useT } from '../../use-translation.ts';
import { Actions } from '../game/FormParts.tsx';
import { Stepper } from '../game/Stepper.tsx';
import { ObjectiveCard } from './ObjectiveCard.tsx';
import { ScoreAction } from './ScoreAction.tsx';

interface TurnProps {
  readonly game: GameState;
  readonly player: PlayerId;
}

/** RR 73.1: erfüllbare Aufträge werten, dann „Fertig“. */
function ScoringStep({ game, player }: TurnProps): ReactElement {
  const t = useT();
  const send = useGameStore((state) => state.send);
  const options = scoringOptions(game, player, content);
  return (
    <div className="turn-block">
      <h3>{t('scoreObjectives')}</h3>
      {options.length === 0 && <p className="hint">{t('nothingToScore')}</p>}
      <ul className="objective-row">
        {options.map((option) => (
          <ObjectiveCard key={option.definition.id} game={game} definition={option.definition}>
            <ScoreAction game={game} player={player} option={option} />
          </ObjectiveCard>
        ))}
      </ul>
      <button type="button" onClick={() => send({ type: 'EndScoring', issuedBy: player })}>
        {t('doneScoring')}
      </button>
    </div>
  );
}

const NO_POOLS: PoolCounts = { tactic: 0, fleet: 0, strategy: 0 };
const total = (pools: PoolCounts) => COMMAND_POOLS.reduce((sum, pool) => sum + pools[pool], 0);

/** Neue Verteilung ab den aktuellen Pools; frei sind die erhaltenen Marker. */
function useAllocation({ game, player }: TurnProps) {
  const own = findPlayer(game, player);
  const current = own?.commandPools ?? NO_POOLS;
  const reinforcements = own?.reinforcementTokens ?? 0;
  const gained = Math.min(game.config.rules.statusPhaseCommandTokens, reinforcements);
  const [pools, setPools] = useState<PoolCounts>(current);
  const change = (pool: CommandPool, delta: number) =>
    setPools((before) => ({ ...before, [pool]: before[pool] + delta }));
  return { gained, pools, change, free: total(current) + gained - total(pools) };
}

/** RR 73.5: Marker erhalten und alle Marker der Tafel neu verteilen. */
function TokenStep(props: TurnProps): ReactElement {
  const t = useT();
  const send = useGameStore((state) => state.send);
  const { gained, pools, change, free } = useAllocation(props);
  const allocate = () => send({ type: 'AllocateCommandTokens', issuedBy: props.player, pools });
  return (
    <div className="turn-block">
      <h3>{t('allocateTokens')}</h3>
      <p className="hint">
        {t('tokensGained')}: {gained} · {t('toDistribute')}:{' '}
        <strong data-testid="free-tokens">{free}</strong>
      </p>
      {COMMAND_POOLS.map((pool) => (
        <Stepper
          key={pool}
          label={t(pool)}
          value={pools[pool]}
          canAdd={free > 0}
          onChange={(d) => change(pool, d)}
        />
      ))}
      <Actions label={t('confirm')} disabled={free !== 0} onClick={allocate} />
    </div>
  );
}

/** Statusphase für den Spieler am Bildschirm. */
export function StatusTurn({ game, player }: TurnProps): ReactElement {
  return game.statusPhase?.step === 'tokens' ? (
    <TokenStep key={player} game={game} player={player} />
  ) : (
    <ScoringStep key={player} game={game} player={player} />
  );
}

/** RR 68.7: Die Partie ist entschieden. */
export function GameOverNotice({ game }: { readonly game: GameState }): ReactElement {
  const t = useT();
  const winner = findPlayer(game, game.winner ?? ('' as PlayerId));
  return (
    <div className="game-over" role="status">
      <h2>{t('gameOver')}</h2>
      <p>
        {t('winner')}: <strong>{winner?.name}</strong> ({winner?.victoryPoints} {t('victoryPoints')}
        )
      </p>
    </div>
  );
}
