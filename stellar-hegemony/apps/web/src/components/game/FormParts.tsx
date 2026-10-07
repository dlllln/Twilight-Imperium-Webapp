import type { GameState, PlanetId, SystemId } from '@stellar/domain';
import type { ReactElement, ReactNode } from 'react';
import { planetLabel, systemLabel } from '../../labels.ts';
import { useLanguage } from '../../use-translation.ts';

interface SelectProps<T extends string> {
  readonly label?: string;
  readonly options: readonly T[];
  readonly value: T | null;
  readonly onChange: (value: T | null) => void;
  /** Eintrag für „keine Auswahl“; ohne ihn ist immer etwas gewählt. */
  readonly none?: string;
}

/** Auswahlliste über Kennungen; die Beschriftung liefert `text`. */
function IdSelect<T extends string>(props: SelectProps<T> & { readonly text: (id: T) => string }) {
  const select = (
    <select
      value={props.value ?? ''}
      onChange={(event) =>
        props.onChange(props.options.find((id) => id === event.target.value) ?? null)
      }
    >
      {props.none !== undefined && <option value="">{props.none}</option>}
      {props.options.map((id) => (
        <option key={id} value={id}>
          {props.text(id)}
        </option>
      ))}
    </select>
  );
  if (props.label === undefined) return select;
  return (
    <label>
      {props.label}
      {select}
    </label>
  );
}

export function SystemSelect(
  props: SelectProps<SystemId> & { readonly game: GameState },
): ReactElement {
  const language = useLanguage();
  return <IdSelect {...props} text={(id) => systemLabel(props.game, id, language)} />;
}

export function PlanetSelect(props: SelectProps<PlanetId>): ReactElement {
  const language = useLanguage();
  return <IdSelect {...props} text={(id) => planetLabel(id, language)} />;
}

/** Bestätigen plus weitere Knöpfe des Aufrufers (z. B. Zurück, Ablehnen). */
export function Actions(props: {
  readonly label: string;
  readonly disabled?: boolean;
  readonly onClick: () => void;
  readonly children?: ReactNode;
}): ReactElement {
  return (
    <div className="actions">
      <button type="button" disabled={props.disabled ?? false} onClick={props.onClick}>
        {props.label}
      </button>
      {props.children}
    </div>
  );
}
