import {
  canExploreFrontier,
  type GameState,
  type MovementOption,
  type PlayerId,
  type ShipMoveOrder,
  type SystemId,
  type TacticalActionState,
} from '@stellar/domain';
import type { ReactElement } from 'react';
import { useGameStore } from '../../game-store.ts';
import { systemLabel, unitLabel } from '../../labels.ts';
import { content } from '../../store.ts';
import { cargoAtOrigin, movementChoices } from '../../tactical-view.ts';
import { unitsOf } from '../../unit-stats.ts';
import { useLanguage, useT } from '../../use-translation.ts';
import { moveOrders, useMovementOrders } from '../../system/movement-draft.ts';
import { moveSummary } from '../../table/move-draft.ts';
import { BombardForm, LandingForm } from './InvasionForms.tsx';
import { ProductionForm } from './ProductionForm.tsx';
import { TransactionForm } from './TransactionForm.tsx';

interface TurnProps {
  readonly game: GameState;
  readonly player: PlayerId;
}

type OrdersApi = ReturnType<typeof useMovementOrders>;

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

/** Messleiste „Schiffe n · Fracht m“ über den Befehlen, die „Schiffe bewegen“ abschicken würde. */
function MovementMeter({ moves }: { readonly moves: readonly ShipMoveOrder[] }) {
  const t = useT();
  if (moves.length === 0) return null;
  const { ships, cargo } = moveSummary(Object.fromEntries(moves.map((m) => [m.ship, m.cargo])));
  return (
    <p className="movement-meter" data-testid="move-summary" aria-live="polite">
      {t('moveSummary').replace('{ships}', String(ships)).replace('{cargo}', String(cargo))}
    </p>
  );
}

function MovementForm({ game, player }: TurnProps): ReactElement {
  const t = useT();
  const send = useGameStore((state) => state.send);
  const options = movementChoices(game, content);
  const api = useMovementOrders(game);
  const moves = moveOrders(options, api.orders);
  return (
    <div className="choice-form">
      <h3>{t('movement')}</h3>
      {options.length > 0 && <p className="hint">{t('fleetDragHint')}</p>}
      {options.length === 0 && <p className="hint">{t('noMovableShips')}</p>}
      <ul className="ship-choices">
        {options.map((option) => (
          <ShipChoice key={option.ship.id} game={game} player={player} option={option} api={api} />
        ))}
      </ul>
      <MovementMeter moves={moves} />
      <button type="button" onClick={() => send({ type: 'MoveShips', issuedBy: player, moves })}>
        {moves.length === 0 ? t('skipMovement') : t('moveShips')}
      </button>
    </div>
  );
}

/** Hinweis, solange im aktivierten System Weltraumkanonen oder Raumkampf laufen. */
export function CombatPending(): ReactElement {
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

/** Am Ende der Taktikaktion: PoK Grenzmarker erkunden, falls Schiff und Technologie da sind. */
function DoneStep({ game, player }: TurnProps): ReactElement {
  const t = useT();
  const send = useGameStore((state) => state.send);
  const explore = () => send({ type: 'ExploreFrontier', issuedBy: player });
  return (
    <>
      <p className="hint">{t('tacticalDone')}</p>
      {canExploreFrontier(game, player, content) && (
        <button type="button" className="primary" onClick={explore}>
          {t('exploreFrontier')}
        </button>
      )}
    </>
  );
}

/** Das Formular zum aktuellen Schritt der Taktikaktion (Kampfschritte laufen in der Kampfansicht). */
function StepForm({ game, player, step, system }: TurnProps & TacticalActionState) {
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
      return <DoneStep game={game} player={player} />;
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
