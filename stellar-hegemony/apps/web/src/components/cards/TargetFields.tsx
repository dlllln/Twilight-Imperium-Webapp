import {
  type ActionTarget,
  COMMAND_POOLS,
  type GameState,
  type PlanetId,
  type TargetOptions,
} from '@stellar/domain';
import type { ReactElement } from 'react';
import { planetLabel } from '../../labels.ts';
import { useLanguage, useT } from '../../use-translation.ts';
import { SystemSelect } from '../game/FormParts.tsx';

/** Vorauswahl: jeweils die erste zugelassene Möglichkeit, damit die Karte sofort spielbar ist. */
export function initialTarget(options: TargetOptions): ActionTarget {
  const planet = options.planets?.options[0];
  const system = options.systems?.[0];
  const player = options.players?.[0];
  return {
    ...(planet === undefined ? {} : { planets: [planet] }),
    ...(system === undefined ? {} : { system }),
    ...(player === undefined ? {} : { player }),
    ...(options.pool === undefined ? {} : { pool: 'tactic' as const }),
  };
}

export const hasTargets = (options: TargetOptions): boolean =>
  Object.values(options).some((option) => option !== undefined);

/** Verlangte Planeten müssen gewählt sein; alle anderen Felder sind immer belegt. */
export const targetComplete = (options: TargetOptions, target: ActionTarget): boolean =>
  options.planets === undefined || (target.planets ?? []).length > 0;

interface FieldProps {
  readonly game: GameState;
  readonly options: TargetOptions;
  readonly value: ActionTarget;
  readonly onChange: (target: ActionTarget) => void;
}

const toggled = (list: readonly PlanetId[], id: PlanetId) =>
  list.includes(id) ? list.filter((other) => other !== id) : [...list, id];

function PlanetFields({ options, value, onChange }: FieldProps): ReactElement | null {
  const t = useT();
  const language = useLanguage();
  const planets = options.planets;
  if (planets === undefined) return null;
  const chosen = value.planets ?? [];
  return (
    <fieldset className="card-target">
      <legend>{t('targetPlanets').replace('{n}', String(planets.max))}</legend>
      {planets.options.map((planet) => (
        <label key={planet}>
          <input
            type="checkbox"
            checked={chosen.includes(planet)}
            disabled={!chosen.includes(planet) && chosen.length >= planets.max}
            onChange={() => onChange({ ...value, planets: toggled(chosen, planet) })}
          />
          {planetLabel(planet, language)}
        </label>
      ))}
    </fieldset>
  );
}

function PlayerField({ game, options, value, onChange }: FieldProps): ReactElement | null {
  const t = useT();
  const players = game.players.filter((player) => options.players?.includes(player.id));
  if (options.players === undefined) return null;
  return (
    <label>
      {t('targetPlayer')}
      <select
        value={value.player ?? ''}
        onChange={(event) => {
          const player = players.find((p) => p.id === event.target.value)?.id;
          if (player !== undefined) onChange({ ...value, player });
        }}
      >
        {players.map((player) => (
          <option key={player.id} value={player.id}>
            {player.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function PoolField({ options, value, onChange }: FieldProps): ReactElement | null {
  const t = useT();
  if (options.pool === undefined) return null;
  return (
    <label>
      {t('targetPool')}
      <select
        value={value.pool ?? 'tactic'}
        onChange={(event) => {
          const pool = COMMAND_POOLS.find((candidate) => candidate === event.target.value);
          if (pool !== undefined) onChange({ ...value, pool });
        }}
      >
        {COMMAND_POOLS.map((pool) => (
          <option key={pool} value={pool}>
            {t(pool)}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Eingaben für genau die Zielarten, die die Karte verlangt. */
export function TargetFields(props: FieldProps): ReactElement {
  const t = useT();
  const { game, options, value, onChange } = props;
  return (
    <div className="card-targets">
      <PlanetFields {...props} />
      {options.systems !== undefined && (
        <SystemSelect
          game={game}
          label={t('targetSystem')}
          options={options.systems}
          value={value.system ?? null}
          onChange={(system) => {
            if (system !== null) onChange({ ...value, system });
          }}
        />
      )}
      <PlayerField {...props} />
      <PoolField {...props} />
    </div>
  );
}
