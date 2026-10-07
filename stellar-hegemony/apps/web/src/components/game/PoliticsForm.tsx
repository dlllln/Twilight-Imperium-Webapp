import type { GameState, PlayerId, PoliticsChoice, StrategyCardDefinition } from '@stellar/domain';
import { type ReactElement, type ReactNode, useState } from 'react';
import { useT } from '../../use-translation.ts';
import { Actions } from './FormParts.tsx';

export interface PoliticsFormProps {
  readonly game: GameState;
  readonly player: PlayerId;
  readonly card: StrategyCardDefinition;
  readonly ability: 'primary' | 'secondary';
  readonly onSubmit: (choice: PoliticsChoice) => void;
  readonly children?: ReactNode;
}

function SpeakerSelect(props: {
  readonly game: GameState;
  readonly value: PlayerId | null;
  readonly onChange: (speaker: PlayerId | null) => void;
}): ReactElement {
  const t = useT();
  const candidates = props.game.players.filter((player) => player.id !== props.game.speaker);
  return (
    <label>
      {t('chooseSpeaker')}
      <select
        value={props.value ?? ''}
        onChange={(event) =>
          props.onChange(candidates.find((player) => player.id === event.target.value)?.id ?? null)
        }
      >
        {candidates.map((player) => (
          <option key={player.id} value={player.id}>
            {player.name}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Primär: ein Spieler ohne Sprechermarker wird Sprecher. */
function SpeakerPicker(props: PoliticsFormProps): ReactElement {
  const t = useT();
  const first = props.game.players.find((player) => player.id !== props.game.speaker);
  const [speaker, setSpeaker] = useState<PlayerId | null>(first?.id ?? null);
  return (
    <div className="choice-form">
      <SpeakerSelect game={props.game} value={speaker} onChange={setSpeaker} />
      <Actions
        label={t('confirm')}
        disabled={speaker === null}
        onClick={() => props.onSubmit({ mechanic: 'politics', speaker })}
      >
        {props.children}
      </Actions>
    </div>
  );
}

/** Politik: Sprecher wechseln; die Sekundärfähigkeit zieht Aktionskarten (RR 61.3). */
export function PoliticsForm(props: PoliticsFormProps): ReactElement {
  const t = useT();
  if (props.ability === 'primary') return <SpeakerPicker {...props} />;
  return (
    <div className="choice-form">
      <p className="hint">{t('politicsDraw')}</p>
      <Actions
        label={t('confirm')}
        onClick={() => props.onSubmit({ mechanic: 'politics', speaker: null })}
      >
        {props.children}
      </Actions>
    </div>
  );
}
