import {
  type GameState,
  type MovementOption,
  type PlayerId,
  type ShipMoveOrder,
  type SystemId,
  type TacticalActionState,
  type UnitId,
} from '@stellar/domain';
import { type ReactElement, useState } from 'react';
import { useGameStore } from '../../game-store.ts';
import { systemLabel, unitLabel } from '../../labels.ts';
import { content } from '../../store.ts';
import { cargoAtOrigin, movementChoices } from '../../tactical-view.ts';
import { unitsOf } from '../../unit-stats.ts';
import { useLanguage, useT } from '../../use-translation.ts';
import { BombardForm, LandingForm } from './InvasionForms.tsx';
import { ProductionForm } from './ProductionForm.tsx';
import { TransactionForm } from './TransactionForm.tsx';

interface TurnProps {
  readonly game: GameState;
  readonly player: PlayerId;
}

type Orders = Readonly<Record<string, readonly UnitId[]>>;

/** Gewählte Schiffe mit ihrer Fracht; Fracht gehört immer nur einem Schiff. */
function useOrders() {
  const [orders, setOrders] = useState<Orders>({});
  const toggleShip = (ship: UnitId) =>
    setOrders(({ [ship]: removed, ...rest }) =>
      removed === undefined ? { ...rest, [ship]: [] } : rest,
    );
  const toggleCargo = (ship: UnitId, unit: UnitId) =>
    setOrders((current) => {
      const cargo = current[ship] ?? [];
      const next = cargo.includes(unit) ? cargo.filter((id) => id !== unit) : [...cargo, unit];
      return { ...current, [ship]: next };
    });
  const loadedElsewhere = (ship: UnitId, unit: UnitId) =>
    Object.entries(orders).some(([other, cargo]) => other !== ship && cargo.includes(unit));
  return { orders, toggleShip, toggleCargo, loadedElsewhere };
}

type OrdersApi = ReturnType<typeof useOrders>;

interface OptionProps extends TurnProps {
  readonly option: MovementOption;
  readonly api: OrdersApi;
}

function CargoChoices({ game, player, option, api }: OptionProps): ReactElement | null {
  const language = useLanguage();
  const capacity = unitsOf(game).find(option.ship.type, player)?.capacity ?? 0;
  const loaded = api.orders[option.ship.id] ?? [];
  const candidates = cargoAtOrigin(game, content, option, player);
  if (capacity === 0 || candidates.length === 0) return null;
  return (
    <ul className="cargo">
      {candidates.map((unit) => (
        <li key={unit.id}>
          <label>
            <input
              type="checkbox"
              checked={loaded.includes(unit.id)}
              disabled={
                api.loadedElsewhere(option.ship.id, unit.id) ||
                (!loaded.includes(unit.id) && loaded.length >= capacity)
              }
              onChange={() => api.toggleCargo(option.ship.id, unit.id)}
            />
            {unitLabel(unit.type, language)}
          </label>
        </li>
      ))}
    </ul>
  );
}

function ShipChoice(props: OptionProps): ReactElement {
  const t = useT();
  const language = useLanguage();
  const { option, api } = props;
  const chosen = api.orders[option.ship.id] !== undefined;
  return (
    <li>
      <label>
        <input type="checkbox" checked={chosen} onChange={() => api.toggleShip(option.ship.id)} />
        {unitLabel(option.ship.type, language)} {t('from')} {option.from.toUpperCase()} (
        {option.path.length} {t(option.path.length === 1 ? 'step' : 'steps')})
      </label>
      {chosen && <CargoChoices {...props} />}
    </li>
  );
}

const ordersFor = (options: readonly MovementOption[], orders: Orders): ShipMoveOrder[] =>
  options.flatMap((option) => {
    const cargo = orders[option.ship.id];
    return cargo === undefined ? [] : [{ ship: option.ship.id, path: option.path, cargo }];
  });

function MovementForm({ game, player }: TurnProps): ReactElement {
  const t = useT();
  const send = useGameStore((state) => state.send);
  const options = movementChoices(game, content);
  const api = useOrders();
  const moves = ordersFor(options, api.orders);
  return (
    <div className="choice-form">
      <h3>{t('movement')}</h3>
      {options.length === 0 && <p className="hint">{t('noMovableShips')}</p>}
      <ul className="ship-choices">
        {options.map((option) => (
          <ShipChoice key={option.ship.id} game={game} player={player} option={option} api={api} />
        ))}
      </ul>
      <button type="button" onClick={() => send({ type: 'MoveShips', issuedBy: player, moves })}>
        {moves.length === 0 ? t('skipMovement') : t('moveShips')}
      </button>
    </div>
  );
}

/** Hinweis, solange im aktivierten System Weltraumkanonen oder Raumkampf laufen. */
function CombatPending(): ReactElement {
  const t = useT();
  const openCombat = useGameStore((state) => state.openCombat);
  return (
    <>
      <p className="hint">{t('combatRunning')}</p>
      <button type="button" onClick={openCombat}>
        {t('openCombat')}
      </button>
    </>
  );
}

function ProductionStep({ game, player, system }: TurnProps & { readonly system: SystemId }) {
  const send = useGameStore((state) => state.send);
  return (
    <ProductionForm
      game={game}
      player={player}
      system={system}
      onSubmit={(request) => send({ type: 'ProduceUnits', issuedBy: player, ...request })}
    />
  );
}

/** Das Formular zum aktuellen Schritt der Taktikaktion (Kampfschritte laufen in der Kampfansicht). */
function StepForm({ game, player, step, system }: TurnProps & TacticalActionState) {
  const t = useT();
  switch (step) {
    case 'movement':
      return <MovementForm game={game} player={player} />;
    case 'bombardment':
      return <BombardForm game={game} player={player} />;
    case 'invasion':
      return <LandingForm game={game} player={player} />;
    case 'production':
      return <ProductionStep game={game} player={player} system={system} />;
    case 'done':
      return <p className="hint">{t('tacticalDone')}</p>;
    default:
      return <CombatPending />;
  }
}

/** Laufende taktische Aktion: Bewegung, Kampf, Bombardement, Einmarsch, Produktion, dann beenden. */
export function TacticalTurn({ game, player }: TurnProps): ReactElement | null {
  const t = useT();
  const language = useLanguage();
  const send = useGameStore((state) => state.send);
  const tactical = game.actionPhase?.tactical;
  if (tactical == null) return null;
  const done = tactical.step === 'done';
  return (
    <div className="turn-block">
      <h3>
        {t('activeSystem')}: {systemLabel(game, tactical.system, language)}
      </h3>
      <StepForm game={game} player={player} {...tactical} />
      <TransactionForm game={game} player={player} />
      <button
        type="button"
        disabled={!done}
        onClick={() => send({ type: 'EndTacticalAction', issuedBy: player })}
      >
        {t('endTactical')}
      </button>
    </div>
  );
}
