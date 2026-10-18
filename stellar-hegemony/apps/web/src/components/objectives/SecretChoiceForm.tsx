import { findPlayer, type GameState, type ObjectiveId, type PlayerId } from '@stellar/domain';
import { Check, EyeOff } from 'lucide-react';
import { type ReactElement, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { objectiveFrame } from '../../artwork/cards.ts';
import { useGameStore } from '../../game-store.ts';
import { errorText } from '../../i18n.ts';
import { objectiveLabel, objectiveRequirement } from '../../labels.ts';
import { useLanguage, useT } from '../../use-translation.ts';
import { CompleteCardArtwork } from '../cards/CompleteCardArtwork.tsx';
import '../cards/card-table.css';

const toggled = (list: readonly ObjectiveId[], id: ObjectiveId) =>
  list.includes(id) ? list.filter((other) => other !== id) : [...list, id];

/** The native modal keeps focus and board shortcuts inside the private choice. */
function useCardTable() {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (dialog === null) return;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    dialog.querySelector<HTMLInputElement>('input')?.focus({ preventScroll: true });
    return () => {
      if (dialog.open && typeof dialog.close === 'function') dialog.close();
    };
  }, []);
  return ref;
}

function SecretOption(props: {
  readonly id: ObjectiveId;
  readonly group: string;
  readonly multiple: boolean;
  readonly checked: boolean;
  readonly disabled: boolean;
  readonly onToggle: () => void;
}): ReactElement {
  return (
    <label className="secret-card" data-selected={props.checked} data-objective={props.id}>
      <input
        className="secret-card-input"
        name={props.group}
        type={props.multiple ? 'checkbox' : 'radio'}
        checked={props.checked}
        disabled={props.disabled}
        onChange={props.onToggle}
      />
      <SecretFace id={props.id} checked={props.checked} />
      <SecretCopy id={props.id} />
    </label>
  );
}

function SecretFace({ id, checked }: { readonly id: ObjectiveId; readonly checked: boolean }) {
  return (
    <span className="secret-card-face">
      <CompleteCardArtwork artwork={objectiveFrame(id, 'secret', null)} />
      {checked && (
        <span className="secret-card-selected" aria-hidden="true">
          <Check size={16} />
        </span>
      )}
    </span>
  );
}

function SecretCopy({ id }: { readonly id: ObjectiveId }) {
  const language = useLanguage();
  const t = useT();
  return (
    <span className="secret-card-copy">
      <span className="secret-card-rule-label">{t('cardTableRule')}</span>
      <strong>{objectiveLabel(id, language)}</strong>
      <span>{objectiveRequirement(id, language)}</span>
    </span>
  );
}

interface SecretChoiceProps {
  readonly game: GameState;
  readonly player: PlayerId;
}

interface CardTableProps {
  readonly player: PlayerId;
  readonly options: readonly ObjectiveId[];
  readonly count: number;
}

function SecretHeader({ id, count }: { readonly id: string; readonly count: number }) {
  const t = useT();
  return (
    <header className="card-table-header">
      <div className="card-table-kicker">
        <span>{t('cardTableChoice')}</span>
        <span className="card-table-private">
          <EyeOff size={14} aria-hidden="true" /> {t('cardTablePrivate')}
        </span>
      </div>
      <h2 id={`${id}-title`}>{t('chooseSecret')}</h2>
      <p id={`${id}-hint`}>{t('chooseSecretHint').replace('{n}', String(count))}</p>
    </header>
  );
}

function SecretSelection({
  keep,
  count,
}: {
  readonly keep: readonly ObjectiveId[];
  readonly count: number;
}) {
  const t = useT();
  const language = useLanguage();
  return (
    <div className="card-table-selection" aria-live="polite">
      <span className="card-table-count">
        {keep.length}/{count} {t('cardTableSelected')}
      </span>
      <strong>
        {keep.length === 0
          ? t('cardTablePick')
          : keep.map((objective) => objectiveLabel(objective, language)).join(' · ')}
      </strong>
    </div>
  );
}

function SecretFooter({
  player,
  count,
  keep,
}: Omit<CardTableProps, 'options'> & { readonly keep: readonly ObjectiveId[] }) {
  const t = useT();
  const send = useGameStore((state) => state.send);
  return (
    <footer className="card-table-footer">
      <SecretSelection keep={keep} count={count} />
      <button
        type="button"
        className="card-table-confirm"
        disabled={keep.length !== count}
        onClick={() => send({ type: 'KeepSecretObjectives', issuedBy: player, keep })}
      >
        <Check size={18} aria-hidden="true" /> {t('keep')}
      </button>
      <p className="card-table-rule-note">{t('cardTableRuleNote')}</p>
      <SecretChoiceError />
    </footer>
  );
}

/** Modal choices must surface a rejected command inside their own focus layer. */
function SecretChoiceError() {
  const language = useLanguage();
  const error = useGameStore((state) => state.error);
  return error === null ? null : (
    <p className="card-table-error" role="alert">
      {errorText(language, error.code)}
    </p>
  );
}

interface SecretSpreadProps extends Omit<CardTableProps, 'player'> {
  readonly keep: readonly ObjectiveId[];
  readonly id: string;
  readonly onChoose: (objective: ObjectiveId) => void;
}

function SecretSpread({ options, count, keep, id, onChoose }: SecretSpreadProps) {
  return (
    <div
      className="card-table-spread"
      role={count === 1 ? 'radiogroup' : 'group'}
      aria-labelledby={`${id}-title`}
    >
      {options.map((objective) => (
        <SecretOption
          key={objective}
          id={objective}
          group={id}
          multiple={count !== 1}
          checked={keep.includes(objective)}
          disabled={count !== 1 && !keep.includes(objective) && keep.length >= count}
          onToggle={() => onChoose(objective)}
        />
      ))}
    </div>
  );
}

function SecretCardTable({ player, options, count }: CardTableProps): ReactElement {
  const [keep, setKeep] = useState<readonly ObjectiveId[]>([]);
  const dialog = useCardTable();
  const id = useId();
  const choose = (objective: ObjectiveId) => {
    setKeep((current) => (count === 1 ? [objective] : toggled(current, objective)));
  };
  return createPortal(
    <dialog
      ref={dialog}
      className="card-table secret-choice"
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-hint`}
      data-tutorial="turn"
      onCancel={(event) => event.preventDefault()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <SecretHeader id={id} count={count} />
      <SecretSpread options={options} count={count} keep={keep} id={id} onChoose={choose} />
      <SecretFooter player={player} count={count} keep={keep} />
    </dialog>,
    document.body,
  );
}

/** Keep local picks through unrelated updates; a new player or offer starts a fresh selection. */
export function SecretChoiceForm({ game, player }: SecretChoiceProps): ReactElement | null {
  const choice = findPlayer(game, player)?.secretChoice;
  if (choice == null) return null;
  return (
    <SecretCardTable
      key={`${player}:${choice.keep}:${choice.options.join('|')}`}
      player={player}
      options={choice.options}
      count={choice.keep}
    />
  );
}
