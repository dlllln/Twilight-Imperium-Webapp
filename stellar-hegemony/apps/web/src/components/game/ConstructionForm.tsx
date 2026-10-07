import {
  type ConstructionChoice,
  type GameState,
  type PlanetId,
  type PlayerId,
  type StrategyCardDefinition,
  type StructurePlacement,
  type SystemId,
  unitTypeId,
} from '@stellar/domain';
import { type ReactElement, type ReactNode, useState } from 'react';
import { constructionSystems, ownPlanets, structureTypes } from '../../card-view.ts';
import { unitLabel } from '../../labels.ts';
import { content } from '../../store.ts';
import { useLanguage, useT } from '../../use-translation.ts';
import { Actions, PlanetSelect, SystemSelect } from './FormParts.tsx';

export interface ConstructionFormProps {
  readonly game: GameState;
  readonly player: PlayerId;
  readonly card: StrategyCardDefinition;
  readonly ability: 'primary' | 'secondary';
  readonly onSubmit: (choice: ConstructionChoice) => void;
  readonly children?: ReactNode;
}

interface RowProps {
  readonly label: string;
  readonly placement: StructurePlacement;
  readonly cannonOnly: boolean;
  readonly planets: readonly PlanetId[];
  readonly onChange: (placement: StructurePlacement) => void;
}

/** Ein Gebäude: Typ und Planet. */
function PlacementRow({ label, placement, cannonOnly, planets, onChange }: RowProps): ReactElement {
  const language = useLanguage();
  const types = structureTypes(content, cannonOnly);
  return (
    <fieldset className="placement">
      <legend>{label}</legend>
      <select
        value={placement.type}
        onChange={(event) => onChange({ ...placement, type: unitTypeId(event.target.value) })}
      >
        {types.map((unit) => (
          <option key={unit.id} value={unit.id}>
            {unitLabel(unit.id, language)}
          </option>
        ))}
      </select>
      <PlanetSelect
        options={planets}
        value={placement.planet}
        onChange={(planet) => planet !== null && onChange({ ...placement, planet })}
      />
    </fieldset>
  );
}

/** Platzierung mit Vorgabe, damit „Bauen“ ohne weitere Auswahl funktioniert. */
function defaultPlacement(planets: readonly PlanetId[], cannonOnly: boolean) {
  const type = structureTypes(content, cannonOnly)[0]?.id;
  const planet = planets[0];
  return type === undefined || planet === undefined ? null : { type, planet };
}

function OptionalSecond(props: {
  readonly planets: readonly PlanetId[];
  readonly value: StructurePlacement | null;
  readonly onChange: (placement: StructurePlacement | null) => void;
}): ReactElement {
  const t = useT();
  const { planets, value, onChange } = props;
  return (
    <>
      <label>
        <input
          type="checkbox"
          checked={value !== null}
          onChange={() => onChange(value === null ? defaultPlacement(planets, true) : null)}
        />
        {t('secondStructure')}
      </label>
      {value !== null && (
        <PlacementRow
          label={t('secondStructure')}
          placement={value}
          cannonOnly
          planets={planets}
          onChange={onChange}
        />
      )}
    </>
  );
}

function PrimaryConstruction(props: ConstructionFormProps): ReactElement {
  const t = useT();
  const planets = ownPlanets(props.game, props.player);
  const [first, setFirst] = useState(defaultPlacement(planets, false));
  const [second, setSecond] = useState<StructurePlacement | null>(null);
  const placements = [first, second].flatMap((p) => (p === null ? [] : [p]));
  const submit = () => props.onSubmit({ mechanic: 'construction', placements, system: null });
  return (
    <div className="choice-form">
      {first !== null && (
        <PlacementRow
          label={t('firstStructure')}
          placement={first}
          cannonOnly={false}
          planets={planets}
          onChange={setFirst}
        />
      )}
      <OptionalSecond planets={planets} value={second} onChange={setSecond} />
      <Actions label={t('build')} disabled={placements.length === 0} onClick={submit}>
        {props.children}
      </Actions>
    </div>
  );
}

function useSecondary(props: ConstructionFormProps) {
  const systems = constructionSystems(props.game, props.player);
  const [system, setSystem] = useState<SystemId | null>(systems[0] ?? null);
  const inSystem = ownPlanets(props.game, props.player).filter(
    (id) => system !== null && props.game.systems[system]?.planetIds.includes(id) === true,
  );
  const [chosen, setPlacement] = useState<StructurePlacement | null>(null);
  const placement =
    chosen !== null && inSystem.includes(chosen.planet)
      ? chosen
      : defaultPlacement(inSystem, false);
  const choice: ConstructionChoice = {
    mechanic: 'construction',
    placements: placement === null ? [] : [placement],
    system,
  };
  return { systems, system, setSystem, inSystem, placement, setPlacement, choice };
}

function SecondaryConstruction(props: ConstructionFormProps): ReactElement {
  const t = useT();
  const form = useSecondary(props);
  const { placement, system } = form;
  const submit = () => props.onSubmit(form.choice);
  return (
    <div className="choice-form">
      <SystemSelect
        game={props.game}
        label={t('chooseSystem')}
        options={form.systems}
        value={system}
        onChange={form.setSystem}
      />
      {placement !== null && (
        <PlacementRow
          label={t('structure')}
          placement={placement}
          cannonOnly={false}
          planets={form.inSystem}
          onChange={form.setPlacement}
        />
      )}
      <Actions label={t('build')} disabled={placement === null} onClick={submit}>
        {props.children}
      </Actions>
    </div>
  );
}

/** Infrastruktur: primär bis zu zwei Gebäude, sekundär eines mit Marker aus dem Nachschub. */
export function ConstructionForm(props: ConstructionFormProps): ReactElement {
  return props.ability === 'primary' ? (
    <PrimaryConstruction {...props} />
  ) : (
    <SecondaryConstruction {...props} />
  );
}
