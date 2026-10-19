import {
  type DiplomacyChoice,
  type GameState,
  type PlanetId,
  type PlayerId,
  readyablePlanets,
  type StrategyCardDefinition,
  systemId,
} from '@stellar/domain';
import { type ReactElement, type ReactNode, useState } from 'react';
import { useGameStore } from '../../game-store.ts';
import { planetLabel, systemLabel } from '../../labels.ts';
import { content } from '../../store.ts';
import { useLanguage, useT } from '../../use-translation.ts';

export interface DiplomacyFormProps {
  readonly game: GameState;
  readonly player: PlayerId;
  readonly card: StrategyCardDefinition;
  readonly ability: 'primary' | 'secondary';
  readonly onSubmit: (choice: DiplomacyChoice) => void;
  readonly children?: ReactNode;
}

/** Systeme außerhalb des Zentrums mit mindestens einem eigenen Planeten (Vorauswahl der Domain-Regel). */
const eligibleSystems = (game: GameState, player: PlayerId): readonly string[] =>
  Object.values(game.systems)
    .filter((system) => content.tiles.find(system.id)?.back !== 'center')
    .filter((system) => system.planetIds.some((id) => game.planets[id]?.controller === player))
    .map((system) => system.id);

interface SystemListProps {
  readonly game: GameState;
  readonly systems: readonly string[];
  readonly value: string;
  readonly onChange: (system: string) => void;
}

function SystemList({ game, systems, value, onChange }: SystemListProps): ReactElement {
  const t = useT();
  const language = useLanguage();
  return (
    <label>
      {t('chooseSystem')}
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {systems.map((id) => (
          <option key={id} value={id}>
            {systemLabel(game, id, language)}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Ohne wählbares System lässt die Domain `system: null` zu; dann bleibt nur das Ausführen. */
function SystemPicker(props: DiplomacyFormProps): ReactElement {
  const t = useT();
  const selected = useGameStore((state) => state.selected);
  const systems = eligibleSystems(props.game, props.player);
  const [system, setSystem] = useState(
    selected !== null && systems.includes(selected) ? selected : (systems[0] ?? ''),
  );
  const chosen = system === '' ? null : systemId(system);
  const choice: DiplomacyChoice = { mechanic: 'diplomacy', system: chosen, planets: [] };
  return (
    <div className="choice-form">
      {chosen !== null && (
        <SystemList game={props.game} systems={systems} value={system} onChange={setSystem} />
      )}
      <div className="actions">
        <button type="button" onClick={() => props.onSubmit(choice)}>
          {t(chosen === null ? 'withoutSystem' : 'confirm')}
        </button>
        {props.children}
      </div>
    </div>
  );
}

function usePlanetSelection(limit: number) {
  const [chosen, setChosen] = useState<readonly PlanetId[]>([]);
  const toggle = (planet: PlanetId) =>
    setChosen((current) =>
      current.includes(planet) ? current.filter((id) => id !== planet) : [...current, planet],
    );
  const canAdd = (planet: PlanetId) => chosen.includes(planet) || chosen.length < limit;
  return { chosen, toggle, canAdd };
}

function PlanetPicker(props: DiplomacyFormProps): ReactElement {
  const t = useT();
  const language = useLanguage();
  const planets = readyablePlanets(props.game, props.player);
  const { chosen, toggle, canAdd } = usePlanetSelection(props.card.parameters.readyPlanets ?? 0);
  const choice: DiplomacyChoice = { mechanic: 'diplomacy', system: null, planets: chosen };
  return (
    <div className="choice-form">
      {planets.length === 0 && <p className="hint">{t('noExhaustedPlanets')}</p>}
      {planets.map((planet) => (
        <label key={planet}>
          <input
            type="checkbox"
            checked={chosen.includes(planet)}
            disabled={!canAdd(planet)}
            onChange={() => toggle(planet)}
          />
          {planetLabel(planet, language)}
        </label>
      ))}
      <div className="actions">
        <button type="button" onClick={() => props.onSubmit(choice)}>
          {t('readyPlanets')}
        </button>
        {props.children}
      </div>
    </div>
  );
}

/** Diplomatie: Primär ein System wählen, sekundär erschöpfte Planeten bereitmachen. */
export function DiplomacyForm(props: DiplomacyFormProps): ReactElement {
  return props.ability === 'primary' ? <SystemPicker {...props} /> : <PlanetPicker {...props} />;
}
