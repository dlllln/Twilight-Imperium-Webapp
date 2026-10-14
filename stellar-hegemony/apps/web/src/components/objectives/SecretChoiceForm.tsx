import { findPlayer, type GameState, type ObjectiveId, type PlayerId } from '@stellar/domain';
import { type ReactElement, useState } from 'react';
import { objectiveArtwork } from '../../artwork/cards.ts';
import { useGameStore } from '../../game-store.ts';
import { objectiveLabel, objectiveRequirement } from '../../labels.ts';
import { useLanguage, useT } from '../../use-translation.ts';
import { Actions } from '../game/FormParts.tsx';
import { CardArtwork } from '../cards/CardArtwork.tsx';

const SECRET_BACK = objectiveArtwork('secret', null);

const toggled = (list: readonly ObjectiveId[], id: ObjectiveId) =>
  list.includes(id) ? list.filter((other) => other !== id) : [...list, id];

function SecretOption(props: {
  readonly id: ObjectiveId;
  readonly checked: boolean;
  readonly disabled: boolean;
  readonly onToggle: () => void;
}): ReactElement {
  const language = useLanguage();
  return (
    <label className="objective-option ti4-secret-option">
      <input
        type="checkbox"
        checked={props.checked}
        disabled={props.disabled}
        onChange={props.onToggle}
      />
      <CardArtwork artwork={SECRET_BACK} className="ti4-secret-choice-art" />
      <strong>{objectiveLabel(props.id, language)}</strong>
      <span className="hint">{objectiveRequirement(props.id, language)}</span>
    </label>
  );
}

interface SecretChoiceProps {
  readonly game: GameState;
  readonly player: PlayerId;
}

/** RR 12.20/37.4: aus den gezogenen geheimen Aufträgen die behaltenen wählen. */
export function SecretChoiceForm({ game, player }: SecretChoiceProps): ReactElement | null {
  const t = useT();
  const send = useGameStore((state) => state.send);
  const [keep, setKeep] = useState<readonly ObjectiveId[]>([]);
  const choice = findPlayer(game, player)?.secretChoice;
  if (choice == null) return null;
  return (
    <div className="turn-block secret-choice">
      <h3>{t('chooseSecret')}</h3>
      <p className="hint">{t('chooseSecretHint').replace('{n}', String(choice.keep))}</p>
      {choice.options.map((id) => (
        <SecretOption
          key={id}
          id={id}
          checked={keep.includes(id)}
          disabled={!keep.includes(id) && keep.length >= choice.keep}
          onToggle={() => setKeep((current) => toggled(current, id))}
        />
      ))}
      <Actions
        label={t('keep')}
        disabled={keep.length !== choice.keep}
        onClick={() => send({ type: 'KeepSecretObjectives', issuedBy: player, keep })}
      />
    </div>
  );
}
