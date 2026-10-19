import {
  type GameState,
  type PlanetAssignment,
  type PlanetId,
  type PlayerId,
  type Unit,
  type UnitId,
} from '@stellar/domain';
import { type ReactElement, useState } from 'react';
import { useGameStore } from '../../game-store.ts';
import { bombardChoices, landingChoices } from '../../invasion-view.ts';
import { unitLabel } from '../../labels.ts';
import { content } from '../../store.ts';
import { useLanguage, useT } from '../../use-translation.ts';
import { PlanetSelect } from './FormParts.tsx';
import { PaymentPicker, usePayment } from './PaymentPicker.tsx';

interface TurnProps {
  readonly game: GameState;
  readonly player: PlayerId;
}

type Targets = Readonly<Record<string, PlanetId>>;

function useTargets() {
  const [targets, setTargets] = useState<Targets>({});
  const choose = (unit: UnitId, planet: PlanetId | null) =>
    setTargets((current) => {
      const rest = Object.fromEntries(Object.entries(current).filter(([id]) => id !== unit));
      return planet === null ? rest : { ...rest, [unit]: planet };
    });
  const assignments: readonly PlanetAssignment[] = Object.entries(targets).map(
    ([unit, planet]) => ({ unit: unit as UnitId, planet }),
  );
  return { targets, choose, assignments };
}

interface RowsProps {
  readonly units: readonly Unit[];
  readonly planets: readonly PlanetId[];
  readonly none: string;
  readonly form: ReturnType<typeof useTargets>;
}

/** Je Einheit der Planet, den sie bombardiert bzw. auf dem sie landet. */
function TargetRows({ units, planets, none, form }: RowsProps): ReactElement {
  const language = useLanguage();
  return (
    <ul className="target-choices">
      {units.map((unit) => (
        <li key={unit.id}>
          <PlanetSelect
            label={unitLabel(unit.type, language)}
            options={planets}
            value={form.targets[unit.id] ?? null}
            none={none}
            onChange={(planet) => form.choose(unit.id, planet)}
          />
        </li>
      ))}
    </ul>
  );
}

/** Bombardement (RR 20): Schiffe den Planeten zuweisen oder darauf verzichten. */
export function BombardForm({ game, player }: TurnProps): ReactElement {
  const t = useT();
  const send = useGameStore((state) => state.send);
  const { ships, planets } = bombardChoices(game, content);
  const form = useTargets();
  return (
    <div className="choice-form">
      <h3>{t('bombardment')}</h3>
      <TargetRows units={ships} planets={planets} none={t('noBombardment')} form={form} />
      <button
        type="button"
        onClick={() => send({ type: 'Bombard', issuedBy: player, targets: form.assignments })}
      >
        {form.assignments.length === 0 ? t('skipBombardment') : t('bombard')}
      </button>
    </div>
  );
}

function useLanding(game: GameState, player: PlayerId) {
  const send = useGameStore((state) => state.send);
  const choices = landingChoices(game, content);
  const form = useTargets();
  const payment = usePayment(game, player, 'influence');
  const paying = choices.centerCost !== null && form.assignments.length > 0;
  const unpaid = paying && payment.value < choices.centerCost;
  const land = () =>
    send({
      type: 'CommitGroundForces',
      issuedBy: player,
      landings: form.assignments,
      centerPayment: paying ? payment.payment : null,
    });
  return { ...choices, form, payment, paying, unpaid, land };
}

/** Einmarsch (RR 25): Bodentruppen landen; auf der Thronwelt kostet das Einfluss, erst bezahlen. */
export function LandingForm({ game, player }: TurnProps): ReactElement {
  const t = useT();
  const landing = useLanding(game, player);
  const { form, centerCost } = landing;
  return (
    <div className="choice-form">
      <h3>{t('invasion')}</h3>
      <TargetRows
        units={landing.forces}
        planets={landing.planets}
        none={t('stayInSpace')}
        form={form}
      />
      {landing.paying && centerCost !== null && (
        <PaymentPicker
          game={game}
          player={player}
          currency="influence"
          required={centerCost}
          state={landing.payment}
        />
      )}
      <button type="button" disabled={landing.unpaid} onClick={landing.land}>
        {form.assignments.length === 0 ? t('skipInvasion') : t('land')}
      </button>
    </div>
  );
}
