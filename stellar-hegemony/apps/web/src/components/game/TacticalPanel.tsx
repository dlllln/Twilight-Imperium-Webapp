import {
  type GameState,
  type MovementOption,
  type PlayerId,
  type ShipMoveOrder,
  systemId,
  type UnitId,
} from '@stellar/domain';
import { type ReactElement, useState } from 'react';
import { useGameStore } from '../../game-store.ts';
import { systemLabel, unitLabel } from '../../labels.ts';
import { content } from '../../store.ts';
import { cargoAtOrigin, movementChoices } from '../../tactical-view.ts';
import { useLanguage, useT } from '../../use-translation.ts';

interface TurnProps {
  readonly game: GameState;
  readonly player: PlayerId;
}

/** Taktische Aktion beginnen: das auf der Karte gewählte System aktivieren. */
export function ActivationBlock({ game, player }: TurnProps): ReactElement {
  const t = useT();
  const language = useLanguage();
  const send = useGameStore((state) => state.send);
  const selected = useGameStore((state) => state.selected);
  const activate = () => {
    if (selected !== null)
      send({ type: 'ActivateSystem', issuedBy: player, system: systemId(selected) });
  };
  return (
    <div className="turn-block">
      <h3>{t('tacticalAction')}</h3>
      <p className="hint">
        {selected === null
          ? t('selectSystemHint')
          : `${t('selectedSystem')}: ${systemLabel(game, selected, language)}`}
      </p>
      <button type="button" disabled={selected === null} onClick={activate}>
        {t('activateSystem')}
      </button>
    </div>
  );
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
  const capacity = content.units.find(option.ship.type)?.capacity ?? 0;
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
  if (options.length === 0) return <p className="hint">{t('noMovableShips')}</p>;
  return (
    <div className="choice-form">
      <h3>{t('movement')}</h3>
      <ul className="ship-choices">
        {options.map((option) => (
          <ShipChoice key={option.ship.id} game={game} player={player} option={option} api={api} />
        ))}
      </ul>
      <button
        type="button"
        disabled={moves.length === 0}
        onClick={() => send({ type: 'MoveShips', issuedBy: player, moves })}
      >
        {t('moveShips')}
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

/** Laufende taktische Aktion: Bewegung, Kampf (eigene Ansicht), dann beenden. */
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
      {tactical.step === 'movement' && <MovementForm game={game} player={player} />}
      {done && <p className="hint">{t('fleetArrived')}</p>}
      {!done && tactical.step !== 'movement' && <CombatPending />}
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
