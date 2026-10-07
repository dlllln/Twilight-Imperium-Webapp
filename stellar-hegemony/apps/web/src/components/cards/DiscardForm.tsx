import { excessActionCards, findPlayer, type GameState, type PlayerId } from '@stellar/domain';
import { type ReactElement, useState } from 'react';
import { useGameStore } from '../../game-store.ts';
import { actionCardLabel } from '../../labels.ts';
import { useLanguage, useT } from '../../use-translation.ts';
import { Actions } from '../game/FormParts.tsx';

const toggled = (list: readonly number[], index: number) =>
  list.includes(index) ? list.filter((other) => other !== index) : [...list, index];

function DiscardOption(props: {
  readonly card: string;
  readonly checked: boolean;
  readonly disabled: boolean;
  readonly onToggle: () => void;
}): ReactElement {
  const language = useLanguage();
  return (
    <label>
      <input
        type="checkbox"
        checked={props.checked}
        disabled={props.disabled}
        onChange={props.onToggle}
      />
      {actionCardLabel(props.card, language)}
    </label>
  );
}

interface DiscardProps {
  readonly game: GameState;
  readonly player: PlayerId;
}

/** RR 3.4: über dem Handkartenlimit genau die überzähligen Karten ablegen. */
export function DiscardForm({ game, player }: DiscardProps): ReactElement {
  const t = useT();
  const send = useGameStore((state) => state.send);
  const [chosen, setChosen] = useState<readonly number[]>([]);
  const hand = findPlayer(game, player)?.actionCards ?? [];
  const excess = excessActionCards(game, player);
  const cards = chosen.flatMap((index) => hand[index] ?? []);
  return (
    <div className="turn-block discard-form">
      <h3>{t('discardCards')}</h3>
      <p className="hint">{t('discardHint').replace('{n}', String(excess))}</p>
      {hand.map((card, index) => (
        <DiscardOption
          key={`${card}-${String(index)}`}
          card={card}
          checked={chosen.includes(index)}
          disabled={!chosen.includes(index) && chosen.length >= excess}
          onToggle={() => setChosen((current) => toggled(current, index))}
        />
      ))}
      <Actions
        label={t('discard')}
        disabled={cards.length !== excess}
        onClick={() => send({ type: 'DiscardActionCards', issuedBy: player, cards })}
      />
    </div>
  );
}
